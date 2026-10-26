import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { interviewRequestSchema } from "@/lib/interview/interviewRequestSchema";
import { loadInterviewBoundaries } from "@/lib/interviewMemory/loadInterviewBoundaries";
import { retractInterviewBoundary } from "@/lib/interviewMemory/retractInterviewBoundary";
import { saveInterviewBoundary } from "@/lib/interviewMemory/saveInterviewBoundary";
import { consumeInterviewPreparation } from "@/lib/interviewPreparation/consumeInterviewPreparation";
import { fetchArtistKnowledge } from "@/lib/interviewPreparation/fetchArtistKnowledge";
import { fetchMandatoryInterviewMemory } from "@/lib/interviewPreparation/fetchMandatoryInterviewMemory";
import { getInterviewPreparation } from "@/lib/interviewPreparation/getInterviewPreparation";
import { queueInterviewPreparationInTransaction } from "@/lib/interviewPreparation/queueInterviewPreparationInTransaction";
import { finishInterviewSession } from "@/lib/interviewSessions/finishInterviewSession";
import { getInterviewSession } from "@/lib/interviewSessions/getInterviewSession";
import { readInterviewSessionBody } from "@/lib/interviewSessions/readInterviewSessionBody";
import { saveInterviewAnswer } from "@/lib/interviewSessions/saveInterviewAnswer";
import { startInterviewSession } from "@/lib/interviewSessions/startInterviewSession";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * MusicNerdWeb's interview route: one authenticated boundary that restores
 * sessions and queues or consumes durable preparation by calling the owning
 * interview, preparation, memory and knowledge functions in this process. No
 * model calls in the request. Request actions, response shapes and status
 * codes are the website's; its interview UI depends on them.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param artistId - The artist id from the path.
 * @returns The action's result, or `{ status: "error", error }` with the website's status code.
 */
export async function handleArtistInterview(request: Request, artistId: string) {
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  const fail = (error: string, status: number) => reply({ status: "error", error }, status);
  if (!z.uuid().safeParse(artistId).success) return fail("Invalid artist.", 400);
  const authorization = request.headers.get("authorization");
  if (
    !authorization ||
    authorization.length > 8192 ||
    !/^Bearer [A-Za-z0-9._~+/=-]+$/.test(authorization)
  )
    return fail("Sign in to continue the interview.", 401);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(105000)]);
  try {
    if (new URL(request.url).search) return fail("Unexpected interview query.", 400);
    if (request.method !== "GET" && request.method !== "POST")
      return fail("Method unavailable.", 405);
    const parsed =
      request.method === "POST"
        ? interviewRequestSchema.safeParse(await readInterviewSessionBody(request))
        : null;
    if (parsed && !parsed.success) return fail("Invalid interview request.", 400);
    const auth = await authenticateRequest(request);
    if (auth instanceof NextResponse)
      throw Object.assign(new Error("Sign in to continue the interview."), { status: 401 });
    const { userId } = auth;
    const config = { artistId, userId };
    const restore = async () => {
      const state = await getInterviewSession(artistId, userId);
      if (
        state.session?.state !== "active" ||
        state.legacyOffers.length ||
        state.session.questions.some(question => question.state === "offered")
      )
        return state;
      const { preparation } = await getInterviewPreparation(artistId, userId, state.session.id);
      return { ...state, preparation };
    };
    if (!parsed) return reply(await restore());
    const input = parsed.data;
    if (input.action === "source")
      return reply(
        await fetchArtistKnowledge(
          config,
          "read",
          {
            sourceId: input.sourceId,
            revision: input.revision,
            start: Math.max(0, input.start - 1000),
            maxChars: 8000,
            includeVersion: true,
          },
          signal,
        ),
      );
    if (input.action === "memory" || input.action === "boundaries") {
      const state = await restore();
      const sitting =
        state.session?.state === "active"
          ? state.session.sitting
          : (state.legacyOffers[0]?.sitting ?? (state.session?.sitting ?? 0) + 1);
      if (input.action === "boundaries")
        return reply(
          await loadInterviewBoundaries(artistId, userId, {
            sitting,
            ...(input.cursor ? { cursor: input.cursor } : {}),
          }),
        );
      return reply(await fetchMandatoryInterviewMemory(config, sitting, signal));
    }
    if (input.action === "boundary") {
      await saveInterviewBoundary(artistId, userId, {
        requestId: input.requestId,
        questionKey: input.questionKey,
        wording: input.wording,
        scope: input.scope,
      });
      return reply({ status: "ok" });
    }
    if (input.action === "retract") {
      await retractInterviewBoundary(artistId, userId, input.boundaryId, input.revision);
      return reply({ status: "ok" });
    }
    if (input.action === "answer") {
      const saved = await saveInterviewAnswer(artistId, userId, input.answerId, {
        expectedRevision: input.expectedRevision,
        answer: input.answer,
      });
      return reply({ ...(await restore()), savedQuestion: saved.question });
    }
    if (input.action === "finish") {
      await finishInterviewSession(artistId, userId, input.sessionId);
      return reply(await restore());
    }
    const state =
      input.action === "start"
        ? await startInterviewSession(artistId, userId, { requestId: input.requestId })
        : await getInterviewSession(artistId, userId);
    const session = state.session;
    if (
      !session ||
      session.state !== "active" ||
      state.legacyOffers.length ||
      ("sessionId" in input && session.id !== input.sessionId)
    )
      return fail("Reload the saved interview before continuing.", 409);
    if (
      session.questions.some(q => q.state === "offered") &&
      !(input.action === "continue" && session.needsPreparedBankResume)
    )
      return reply(state);
    if (session.questions.length >= 3)
      return fail("This session is complete. Finish when you’re ready.", 409);
    if (input.action === "continue") {
      await consumeInterviewPreparation(artistId, userId, session.id);
      return reply(await restore());
    }
    const prepared = await db.transaction(tx =>
      queueInterviewPreparationInTransaction(tx, artistId, userId, session.id),
    );
    return reply({ ...state, preparation: prepared.preparation });
  } catch (error) {
    const contextTooLarge =
      error instanceof Error &&
      [
        "Mandatory memory exceeds its context budget",
        "Mandatory memory exceeds its page budget",
        "Mandatory memory response exceeds its byte budget",
        "Mandatory memory API returned HTTP 413; restart after 409, sign in after 401",
        "Mandatory memory exceeds the supported snapshot size",
        "Prior interview history exceeds its page budget",
        "Prior interview history exceeds its response budget",
        "Prior questions exceed their model context budget",
        "Interview check exceeds its context budget",
      ].includes(error.message);
    const candidate =
      typeof error === "object" && error && "status" in error ? error.status : undefined;
    const status =
      typeof candidate === "number" && [400, 401, 403, 404, 409, 413, 429].includes(candidate)
        ? candidate
        : 503;
    return fail(
      status === 401
        ? "Sign in to continue the interview."
        : status === 403
          ? "This account cannot edit this artist."
          : status === 409
            ? "The interview changed. Reload the saved interview."
            : status === 400
              ? "Invalid interview request."
              : contextTooLarge
                ? "I cannot safely prepare another question with all the saved context yet. Your saved answers remain available, and you can still review or remove topic instructions in Topic preferences."
                : "I could not complete that interview step. Your saved interview is still available; reload and try again.",
      status,
    );
  }
}
