import { NextResponse } from "next/server";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { bindQuestionRequest } from "@/lib/questionResearch/bindQuestionRequest";
import { callResearchOperation } from "@/lib/questionResearch/callResearchOperation";
import { continueCandidateResearch } from "@/lib/questionResearch/continueCandidateResearch";
import { continueFallbackQuestionResearch } from "@/lib/questionResearch/continueFallbackQuestionResearch";
import { getOrDraftResearchAnswer } from "@/lib/questionResearch/getOrDraftResearchAnswer";
import { getQuestionResearchStatus } from "@/lib/questionResearch/getQuestionResearchStatus";
import { getQuestionVisitorKey } from "@/lib/questionResearch/getQuestionVisitorKey";
import { getUnresolvedResearchAnswer } from "@/lib/questionResearch/getUnresolvedResearchAnswer";
import { hasCompatibleReuseScope } from "@/lib/questionResearch/hasCompatibleReuseScope";
import { listReusableQuestionCandidates } from "@/lib/questionResearch/listReusableQuestionCandidates";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { parseResearchRouting } from "@/lib/questionResearch/parseResearchRouting";
import { planArtistQuestion } from "@/lib/questionResearch/planArtistQuestion";
import { researchStatusSchema } from "@/lib/questionResearch/publicQuestionSchemas";
import { questionQuotaResponse } from "@/lib/questionResearch/questionQuotaResponse";
import { queueDirectEvidenceResearch } from "@/lib/questionResearch/queueDirectEvidenceResearch";
import { registerResearchQuestion } from "@/lib/questionResearch/registerResearchQuestion";
import { releaseQuestionRequest } from "@/lib/questionResearch/releaseQuestionRequest";
import { reserveQuestionPlanning } from "@/lib/questionResearch/reserveQuestionPlanning";
import { reuseQuestionRequest } from "@/lib/questionResearch/reuseQuestionRequest";
import { validateAskArtistBody } from "@/lib/questionResearch/validateAskArtistBody";

const PUBLIC_ERROR_CODES = [
  "visitor_question_quota",
  "question_planning_quota",
  "saved_evidence_quota",
  "research_quota",
  "research_busy",
];

/** Public chat is limited to the public evidence capability; private history is never loaded. MusicNerdWeb's `handleArtistQuestion`, calling the research library in process instead of over HTTP. */
export async function postAskArtistHandler(request: Request) {
  const signal = AbortSignal.any([
    ...(request.signal ? [request.signal] : []),
    AbortSignal.timeout(55000),
  ]);
  const headers = { ...getCorsHeaders(), "Cache-Control": "private, no-store" };
  const ok = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json({ status: "ok", ...body }, { status, headers });
  const fail = (body: Record<string, unknown>, status: number) =>
    NextResponse.json({ status: "error", ...body }, { status, headers });
  let requestLease: { artistId: string; requestHash: string; token: string } | undefined;
  try {
    const parsed = await validateAskArtistBody(request);
    if (parsed instanceof NextResponse) return parsed;
    const { artistId, question, jobId, conversation } = parsed;
    let artist: Awaited<ReturnType<typeof loadResearchArtist>>;
    try {
      artist = await loadResearchArtist(artistId);
    } catch (error) {
      if (error instanceof KnowledgeError && error.code === "not_found")
        return fail({ error: "Artist not found" }, 404);
      throw error;
    }
    const name = artist.name ?? "This artist";
    const reuse = jobId
      ? null
      : await reuseQuestionRequest({ artistId, artistName: name, question, conversation, signal });
    if (reuse?.state === "ready")
      return ok({
        ...reuse.result,
        bandcamp: artist.bandcamp ? `https://${artist.bandcamp}.bandcamp.com` : null,
        limitations: reuse.limitations,
      });
    if (reuse?.state === "busy")
      throw Object.assign(new Error("An identical request is already running"), {
        status: 429,
        code: "research_busy",
      });
    if (reuse?.state === "claimed")
      requestLease = { artistId, requestHash: reuse.requestHash, token: reuse.token };
    if (!jobId) await reserveQuestionPlanning(artistId, await getQuestionVisitorKey(request));
    const candidates = jobId ? [] : await listReusableQuestionCandidates(artistId);
    const plan = jobId
      ? null
      : await planArtistQuestion(name, question, signal, conversation, candidates);
    if (typeof plan?.clarification === "string")
      return ok({ answer: plan.clarification, sources: [], suggestions: [] });
    const {
      resolvedQuestion: resolved = question,
      answerIntent,
      reuseCandidateId,
      reuseAction,
      ...routing
    } = plan ?? {};
    const resolvedQuestion = typeof resolved === "string" ? resolved : question;
    const candidate =
      typeof reuseCandidateId === "string"
        ? candidates.find(
            c =>
              c.id === reuseCandidateId && hasCompatibleReuseScope(routing, c, String(reuseAction)),
          )
        : undefined;
    if (
      candidate &&
      reuse?.state === "claimed" &&
      typeof answerIntent === "string" &&
      ["same_answer", "adapt_evidence"].includes(String(reuseAction))
    ) {
      const current = researchStatusSchema.parse(
        await callResearchOperation(() =>
          getQuestionResearchStatus(artistId, candidate.jobId, { kind: "service" }),
        ),
      );
      if (current.stage === "complete") {
        const checked = await getOrDraftResearchAnswer({
          artistId,
          artistName: name,
          jobId: candidate.jobId,
          question: resolvedQuestion,
          references: current.references,
          selection: current.selection,
          signal,
          readOnlyQuestionHash: candidate.questionHash,
        });
        if (
          checked.state === "ready" &&
          checked.result.sources.length > 0 &&
          (await registerResearchQuestion(artistId, candidate.jobId, resolvedQuestion))
        ) {
          // Planning and checked-answer generation have separate bounded requests.
          // A semantic match selects evidence; it does not approve a new answer.
          await bindQuestionRequest({
            artistId,
            requestHash: reuse.requestHash,
            token: reuse.token,
            jobId: candidate.jobId,
            question: resolvedQuestion,
            reusable: true,
            answerIntent,
            routing: { ...routing, reuseFallbackJobId: candidate.jobId },
          });
          return ok(
            {
              research: {
                jobId: candidate.jobId,
                resolvedQuestion,
                stage: "complete",
                message: "Checking the sourced answer…",
                provider: current.provider,
              },
            },
            202,
          );
        }
      }
    }
    const state = researchStatusSchema.parse(
      jobId
        ? await callResearchOperation(() =>
            getQuestionResearchStatus(artistId, jobId, { kind: "service" }),
          )
        : await callResearchOperation(() =>
            queueDirectEvidenceResearch(artistId, parseResearchRouting(routing)),
          ),
    );
    if (!jobId && !(await registerResearchQuestion(artistId, state.jobId, resolvedQuestion)))
      return fail(
        {
          error:
            "This saved research has reached its answer limit. Try a different question later.",
        },
        429,
      );
    if (reuse?.state === "claimed")
      await bindQuestionRequest({
        artistId,
        requestHash: reuse.requestHash,
        token: reuse.token,
        jobId: state.jobId,
        question: resolvedQuestion,
        answerIntent: typeof answerIntent === "string" ? answerIntent : undefined,
        routing,
        // An original remaining readable does not prove it is still the newest.
        reusable:
          routing.retrieval !== "latest" &&
          routing.freshness !== "recent" &&
          !routing.fromDate &&
          !routing.toDate,
      });
    if (!jobId || !["complete", "unresolved", "failed", "cancelled"].includes(state.stage))
      return ok(
        {
          research: {
            jobId: state.jobId,
            resolvedQuestion,
            outsideResearchReason: state.outsideResearchReason,
            stage: state.stage,
            message: state.message,
            provider: state.provider,
          },
        },
        202,
      );
    if (state.stage === "failed" || state.stage === "cancelled")
      return fail(
        { error: "I couldn't finish that lookup. Please try again.", retryFromStart: true },
        503,
      );
    if (state.stage !== "complete")
      return ok({
        answer:
          state.stage === "unresolved"
            ? getUnresolvedResearchAnswer(state)
            : "Research could not finish. That does not mean the information doesn't exist.",
        ...(state.outsideResearchReason === "quota"
          ? {
              code: "research_quota",
              resetAt: state.resetAt,
              retryAfterSeconds: state.retryAfterSeconds,
              retryFromStart: true,
            }
          : {}),
        sources: [],
        suggestions: [],
        research: {
          jobId: state.jobId,
          resolvedQuestion,
          outsideResearchReason: state.outsideResearchReason,
          stage: state.stage,
          message: state.message,
        },
        limitations: state.limitations,
      });
    try {
      const outcome = await getOrDraftResearchAnswer({
        artistId,
        artistName: name,
        jobId: state.jobId,
        question: resolvedQuestion,
        references: state.references,
        selection: state.selection,
        signal,
      });
      if (
        outcome.state === "continuing" ||
        (state.selection === "candidates" &&
          outcome.state === "ready" &&
          outcome.result.sources.length === 0)
      ) {
        const continued = await continueCandidateResearch({
          artistId,
          jobId: state.jobId,
          question: resolvedQuestion,
          signal,
        });
        return ok(
          {
            research: {
              jobId: state.jobId,
              resolvedQuestion,
              stage: "pending" in continued ? "complete" : continued.stage,
              message: "Checking Lore…",
            },
          },
          202,
        );
      }
      if (outcome.state === "drafting")
        return ok(
          {
            research: {
              jobId: state.jobId,
              stage: "complete",
              message: "Checking the sourced answer…",
              provider: state.provider,
            },
          },
          202,
        );
      if (outcome.state === "unregistered")
        return fail(
          {
            error: "This question is not attached to the saved research. Start a new question.",
          },
          409,
        );
      if (outcome.state === "unavailable")
        return ok({
          answer:
            "The saved answer's supporting source is no longer available. I cannot verify it now.",
          sources: [],
          suggestions: [],
          research: {
            jobId: state.jobId,
            stage: "unresolved",
            message: "Source access changed.",
          },
        });
      if (outcome.state === "failed")
        return fail(
          {
            error: outcome.retryable
              ? "I couldn't finish checking this answer. Please try again."
              : "I couldn't finish checking this answer after several attempts. Please try again later.",
            jobId: state.jobId,
            verification: { stage: outcome.stage, retryable: outcome.retryable },
          },
          503,
        );
      if (!outcome.result.sources.length) {
        const continued = await continueFallbackQuestionResearch({
          artistId,
          jobId: state.jobId,
          question: resolvedQuestion,
          signal,
        });
        if (continued && "pending" in continued)
          return ok(
            {
              research: {
                jobId: state.jobId,
                resolvedQuestion,
                stage: "complete",
                message: "Checking the sourced answer…",
              },
            },
            202,
          );
        if (continued)
          return ok(
            {
              research: {
                jobId: continued.jobId,
                resolvedQuestion,
                stage: continued.stage,
                message: continued.message,
                provider: continued.provider,
                outsideResearchReason: continued.outsideResearchReason,
              },
            },
            202,
          );
      }
      return ok({
        ...outcome.result,
        bandcamp: artist.bandcamp ? `https://${artist.bandcamp}.bandcamp.com` : null,
        limitations: state.limitations,
      });
    } catch (error) {
      const quota = questionQuotaResponse(error);
      if (quota) return quota;
      return fail(
        { error: "I couldn't finish checking this answer. Please try again.", jobId: state.jobId },
        503,
      );
    }
  } catch (error) {
    const quota = questionQuotaResponse(error);
    if (quota) return quota;
    const status =
      typeof error === "object" && error && "status" in error && error.status === 429 ? 429 : 503;
    const raw = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    // Only the documented `AskArtistError.code` values; a database error code never reaches the visitor.
    const code = PUBLIC_ERROR_CODES.includes(raw) ? raw : undefined;
    return fail(
      {
        code,
        error:
          code === "question_planning_quota"
            ? "The question limit has been reached. Please try again later."
            : code === "saved_evidence_quota"
              ? "The saved-source answer limit has been reached. Please try again later."
              : code === "research_busy"
                ? "Research is busy right now. Please try again shortly."
                : status === 429
                  ? "The research limit has been reached. Try again later."
                  : "Research is temporarily unavailable. Please try again.",
      },
      status,
    );
  } finally {
    if (requestLease)
      await releaseQuestionRequest(
        requestLease.artistId,
        requestLease.requestHash,
        requestLease.token,
      ).catch(() => undefined);
  }
}
