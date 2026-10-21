import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  transaction: vi.fn(),
  session: vi.fn(),
  start: vi.fn(),
  answer: vi.fn(),
  finish: vi.fn(),
  preparation: vi.fn(),
  consume: vi.fn(),
  queue: vi.fn(),
  memory: vi.fn(),
  knowledge: vi.fn(),
  boundaries: vi.fn(),
  boundary: vi.fn(),
  retract: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/interviewSessions/getInterviewSession", () => ({ getInterviewSession: m.session }));
vi.mock("@/lib/interviewSessions/startInterviewSession", () => ({
  startInterviewSession: m.start,
}));
vi.mock("@/lib/interviewSessions/saveInterviewAnswer", () => ({ saveInterviewAnswer: m.answer }));
vi.mock("@/lib/interviewSessions/finishInterviewSession", () => ({
  finishInterviewSession: m.finish,
}));
vi.mock("@/lib/interviewPreparation/getInterviewPreparation", () => ({
  getInterviewPreparation: m.preparation,
}));
vi.mock("@/lib/interviewPreparation/consumeInterviewPreparation", () => ({
  consumeInterviewPreparation: m.consume,
}));
vi.mock("@/lib/interviewPreparation/queueInterviewPreparationInTransaction", () => ({
  queueInterviewPreparationInTransaction: m.queue,
}));
vi.mock("@/lib/interviewPreparation/fetchMandatoryInterviewMemory", () => ({
  fetchMandatoryInterviewMemory: m.memory,
}));
vi.mock("@/lib/interviewPreparation/fetchArtistKnowledge", () => ({
  fetchArtistKnowledge: m.knowledge,
}));
vi.mock("@/lib/interviewMemory/loadInterviewBoundaries", () => ({
  loadInterviewBoundaries: m.boundaries,
}));
vi.mock("@/lib/interviewMemory/saveInterviewBoundary", () => ({
  saveInterviewBoundary: m.boundary,
}));
vi.mock("@/lib/interviewMemory/retractInterviewBoundary", () => ({
  retractInterviewBoundary: m.retract,
}));
const { handleArtistInterview } = await import("@/lib/interview/handleArtistInterview");

const artistId = "11111111-1111-4111-8111-111111111111",
  sessionId = "22222222-2222-4222-8222-222222222222",
  revision = "a".repeat(64);
const question = {
  id: artistId,
  sitting: 1,
  questionKey: "key",
  question: "An existing question?",
  answer: null,
  state: "offered",
  revision,
  offeredAt: "2026-10-06",
  answerUpdatedAt: "2026-10-06",
  ordinal: 1,
  references: [],
};
const state = {
  status: "ok",
  session: {
    id: sessionId,
    sitting: 1,
    state: "active",
    createdAt: "2026-10-06",
    closedAt: null,
    questions: [] as unknown[],
  },
  legacyOffers: [] as unknown[],
};
const idle = { status: "ok", preparation: { status: "idle" } };
const request = (body?: unknown, init: RequestInit = {}) =>
  new Request("https://api.example/api/artist/x/interview", {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer token" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...init,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("MUSICNERD_API_INTERVIEWER_ENABLED", "true");
  m.auth.mockResolvedValue({ userId: "user" });
  m.transaction.mockImplementation(fn => fn({}));
  m.session.mockResolvedValue(state);
  m.start.mockResolvedValue(state);
  m.preparation.mockResolvedValue(idle);
  m.queue.mockResolvedValue({ status: "ok", preparation: { jobId: sessionId, status: "pending" } });
  m.consume.mockResolvedValue({ status: "ok", question, questions: [question] });
});

describe("handleArtistInterview", () => {
  it("is off until MUSICNERD_API_INTERVIEWER_ENABLED is true", async () => {
    vi.stubEnv("MUSICNERD_API_INTERVIEWER_ENABLED", "");
    const r = await handleArtistInterview(request(), artistId);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({
      status: "error",
      error: "This interview preview is not enabled.",
    });
    expect(m.auth).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID artist and a query string", async () => {
    const bad = await handleArtistInterview(request(), "artist");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ status: "error", error: "Invalid artist." });
    const query = await handleArtistInterview(
      new Request("https://api.example/api/artist/x/interview?generate=true", {
        headers: { Authorization: "Bearer token" },
      }),
      artistId,
    );
    expect(query.status).toBe(400);
    expect(await query.json()).toEqual({ status: "error", error: "Unexpected interview query." });
    expect(m.session).not.toHaveBeenCalled();
  });

  it("denies missing or malformed authentication before any read", async () => {
    const r = await handleArtistInterview(new Request("https://api.example"), artistId);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({
      status: "error",
      error: "Sign in to continue the interview.",
    });
    expect(
      (
        await handleArtistInterview(
          request(undefined, { headers: { Authorization: "Basic x" } }),
          artistId,
        )
      ).status,
    ).toBe(401);
    expect(m.auth).not.toHaveBeenCalled();
    expect(m.session).not.toHaveBeenCalled();
  });

  it("denies a token with no Music Nerd user", async () => {
    m.auth.mockResolvedValue(NextResponse.json({ status: "error" }, { status: 401 }));
    const r = await handleArtistInterview(request(), artistId);
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({
      status: "error",
      error: "Sign in to continue the interview.",
    });
    expect(m.session).not.toHaveBeenCalled();
  });

  it("restores state on GET with its preparation, starting nothing", async () => {
    const r = await handleArtistInterview(request(), artistId);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ...state, preparation: { status: "idle" } });
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(m.session).toHaveBeenCalledWith(artistId, "user");
    expect(m.preparation).toHaveBeenCalledWith(artistId, "user", sessionId);
    expect(m.start).not.toHaveBeenCalled();
    expect(m.queue).not.toHaveBeenCalled();
    expect(m.consume).not.toHaveBeenCalled();
  });

  it("restores a finished or offered sitting without reading preparation", async () => {
    m.session.mockResolvedValueOnce({ ...state, session: { ...state.session, state: "finished" } });
    expect(await (await handleArtistInterview(request(), artistId)).json()).toEqual({
      ...state,
      session: { ...state.session, state: "finished" },
    });
    m.session.mockResolvedValueOnce({
      ...state,
      session: { ...state.session, questions: [question] },
    });
    await handleArtistInterview(request(), artistId);
    expect(m.preparation).not.toHaveBeenCalled();
  });

  it("rejects an unknown action, an oversized body and a disguised origin", async () => {
    for (const body of [
      { action: "generate" },
      { action: "start", requestId: sessionId, apiOrigin: "https://attacker.example" },
      { action: "boundaries", sitting: 99 },
      { action: "boundaries", cursor: "x".repeat(4097) },
    ]) {
      const r = await handleArtistInterview(request(body), artistId);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ status: "error", error: "Invalid interview request." });
    }
    expect(
      (
        await handleArtistInterview(
          request(undefined, { method: "POST", body: "a".repeat(65537) }),
          artistId,
        )
      ).status,
    ).toBe(400);
    expect(m.auth).not.toHaveBeenCalled();
    expect(m.session).not.toHaveBeenCalled();
  });

  it("starts explicitly and queues preparation without running a model in the request", async () => {
    const r = await handleArtistInterview(
      request({ action: "start", requestId: sessionId }),
      artistId,
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ...state,
      preparation: { jobId: sessionId, status: "pending" },
    });
    expect(m.start).toHaveBeenCalledWith(artistId, "user", { requestId: sessionId });
    expect(m.queue).toHaveBeenCalledWith({}, artistId, "user", sessionId);
    expect(m.consume).not.toHaveBeenCalled();
  });

  it("prepares for an open sitting it was given", async () => {
    const r = await handleArtistInterview(request({ action: "prepare", sessionId }), artistId);
    expect(r.status).toBe(200);
    expect(m.start).not.toHaveBeenCalled();
    expect(m.queue).toHaveBeenCalledWith({}, artistId, "user", sessionId);
  });

  it("asks for a reload when the sitting is not the active one", async () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const r = await handleArtistInterview(
      request({ action: "continue", sessionId: other }),
      artistId,
    );
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      status: "error",
      error: "Reload the saved interview before continuing.",
    });
    m.session.mockResolvedValueOnce({ ...state, legacyOffers: [question] });
    expect(
      (await handleArtistInterview(request({ action: "prepare", sessionId }), artistId)).status,
    ).toBe(409);
    expect(m.queue).not.toHaveBeenCalled();
  });

  it("returns an already-offered question on Continue instead of consuming another", async () => {
    m.session.mockResolvedValue({ ...state, session: { ...state.session, questions: [question] } });
    const r = await handleArtistInterview(request({ action: "continue", sessionId }), artistId);
    expect(r.status).toBe(200);
    expect(m.consume).not.toHaveBeenCalled();
    expect(m.queue).not.toHaveBeenCalled();
  });

  it("refuses a fourth question", async () => {
    m.session.mockResolvedValue({
      ...state,
      session: {
        ...state.session,
        questions: [1, 2, 3].map(ordinal => ({ ...question, state: "answered", ordinal })),
      },
    });
    const r = await handleArtistInterview(request({ action: "prepare", sessionId }), artistId);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      status: "error",
      error: "This session is complete. Finish when you’re ready.",
    });
  });

  it("consumes a prepared candidate on Continue and restores", async () => {
    const r = await handleArtistInterview(request({ action: "continue", sessionId }), artistId);
    expect(r.status).toBe(200);
    expect(m.consume).toHaveBeenCalledWith(artistId, "user", sessionId);
    expect(m.queue).not.toHaveBeenCalled();
    expect(m.session).toHaveBeenCalledTimes(2);
  });

  it("saves an answer and returns the state with the saved question", async () => {
    m.answer.mockResolvedValue({ status: "ok", question: { ...question, state: "answered" } });
    const r = await handleArtistInterview(
      request({
        action: "answer",
        answerId: artistId,
        expectedRevision: revision,
        answer: "Live.",
      }),
      artistId,
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ...state,
      preparation: { status: "idle" },
      savedQuestion: { ...question, state: "answered" },
    });
    expect(m.answer).toHaveBeenCalledWith(artistId, "user", artistId, {
      expectedRevision: revision,
      answer: "Live.",
    });
  });

  it("finishes the sitting and restores", async () => {
    const r = await handleArtistInterview(request({ action: "finish", sessionId }), artistId);
    expect(r.status).toBe(200);
    expect(m.finish).toHaveBeenCalledWith(artistId, "user", sessionId);
    expect(m.session).toHaveBeenCalledTimes(1);
  });

  it("saves and retracts topic instructions with a bare ok", async () => {
    const boundary = {
      action: "boundary",
      requestId: sessionId,
      questionKey: "key",
      wording: "Skip touring.",
      scope: "sitting",
    };
    const saved = await handleArtistInterview(request(boundary), artistId);
    expect(await saved.json()).toEqual({ status: "ok" });
    expect(m.boundary).toHaveBeenCalledWith(artistId, "user", {
      requestId: sessionId,
      questionKey: "key",
      wording: "Skip touring.",
      scope: "sitting",
    });
    const retracted = await handleArtistInterview(
      request({ action: "retract", boundaryId: sessionId, revision }),
      artistId,
    );
    expect(await retracted.json()).toEqual({ status: "ok" });
    expect(m.retract).toHaveBeenCalledWith(artistId, "user", sessionId, revision);
  });

  it("lists management pages even when mandatory model memory cannot be assembled", async () => {
    const page = { status: "ok", sitting: 1, boundaries: [], nextCursor: null };
    m.memory.mockRejectedValue(new Error("Mandatory memory exceeds its context budget"));
    m.boundaries.mockResolvedValue(page);
    const r = await handleArtistInterview(
      request({ action: "boundaries", cursor: "next" }),
      artistId,
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual(page);
    expect(m.boundaries).toHaveBeenCalledWith(artistId, "user", { sitting: 1, cursor: "next" });
    expect(m.memory).not.toHaveBeenCalled();
  });

  it("restores management for the next sitting without a current offered question", async () => {
    m.session.mockResolvedValue({ ...state, session: { ...state.session, state: "finished" } });
    m.boundaries.mockResolvedValue({ status: "ok", sitting: 2, boundaries: [], nextCursor: null });
    expect((await handleArtistInterview(request({ action: "boundaries" }), artistId)).status).toBe(
      200,
    );
    expect(m.boundaries).toHaveBeenCalledWith(artistId, "user", { sitting: 2 });
    m.session.mockResolvedValue({
      status: "ok",
      session: null,
      legacyOffers: [{ ...question, sitting: 3 }],
    });
    m.memory.mockResolvedValue({ status: "ok", sitting: 3 });
    await handleArtistInterview(request({ action: "memory" }), artistId);
    expect(m.memory).toHaveBeenCalledWith({ artistId, userId: "user" }, 3, expect.any(AbortSignal));
  });

  it("reads a source window before the requested start, pinned to its revision", async () => {
    const read = { status: "ok", passage: {}, version: { state: "current" } };
    m.knowledge.mockResolvedValue(read);
    const r = await handleArtistInterview(
      request({ action: "source", sourceId: `vault:${sessionId}`, revision, start: 400 }),
      artistId,
    );
    expect(await r.json()).toEqual(read);
    expect(m.knowledge).toHaveBeenCalledWith(
      { artistId, userId: "user" },
      "read",
      { sourceId: `vault:${sessionId}`, revision, start: 0, maxChars: 8000, includeVersion: true },
      expect.any(AbortSignal),
    );
  });

  it("maps the owning functions' statuses to the website's messages", async () => {
    m.boundaries.mockRejectedValue(new KnowledgeError("sitting_changed", 409, "changed"));
    const conflict = await handleArtistInterview(request({ action: "boundaries" }), artistId);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      status: "error",
      error: "The interview changed. Reload the saved interview.",
    });
    m.session.mockRejectedValue(new KnowledgeError("forbidden", 403, "Artist claimant required"));
    const forbidden = await handleArtistInterview(request(), artistId);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({
      status: "error",
      error: "This account cannot edit this artist.",
    });
    m.session.mockRejectedValue(new KnowledgeError("not_found", 404, "Artist unavailable"));
    expect((await handleArtistInterview(request(), artistId)).status).toBe(404);
    m.session.mockRejectedValue(new KnowledgeError("invalid_input", 400, "Invalid"));
    expect((await handleArtistInterview(request(), artistId)).status).toBe(400);
  });

  it("hides raw failures behind a 503", async () => {
    m.session.mockRejectedValue(new Error("PRIVATE ORIGINAL"));
    const r = await handleArtistInterview(request({ action: "continue", sessionId }), artistId);
    expect(r.status).toBe(503);
    const body = await r.json();
    expect(body.error).toContain("reload and try again");
    expect(JSON.stringify(body)).not.toContain("PRIVATE ORIGINAL");
  });

  it.each([
    "Mandatory memory exceeds its context budget",
    "Mandatory memory exceeds its page budget",
    "Mandatory memory response exceeds its byte budget",
    "Mandatory memory API returned HTTP 413; restart after 409, sign in after 401",
    "Prior interview history exceeds its page budget",
    "Prior interview history exceeds its response budget",
    "Prior questions exceed their model context budget",
    "Interview check exceeds its context budget",
  ])("explains persistent saved-context limits: %s", async message => {
    m.session.mockRejectedValue(new Error(message));
    const r = await handleArtistInterview(request({ action: "continue", sessionId }), artistId);
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({
      status: "error",
      error:
        "I cannot safely prepare another question with all the saved context yet. Your saved answers remain available, and you can still review or remove topic instructions in Topic preferences.",
    });
  });

  it("preserves a context-limit status without classifying transient failures by a loose keyword", async () => {
    m.session.mockRejectedValue(
      Object.assign(new Error("Mandatory memory exceeds its context budget"), { status: 413 }),
    );
    expect(
      (await handleArtistInterview(request({ action: "continue", sessionId }), artistId)).status,
    ).toBe(413);
    m.session.mockRejectedValue(new Error("A provider budget service timed out"));
    const r = await handleArtistInterview(request({ action: "continue", sessionId }), artistId);
    const body = await r.json();
    expect(r.status).toBe(503);
    expect(body.error).toContain("reload and try again");
    expect(body.error).not.toContain("provider");
  });

  it("answers a JSON error with CORS when the account lookup throws", async () => {
    m.auth.mockRejectedValue(new Error("pool exhausted"));
    const r = await handleArtistInterview(request({ action: "memory" }), artistId);
    expect(r.status).toBe(503);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await r.json();
    expect(body.status).toBe("error");
    expect(body.error).toContain("reload and try again");
    expect(m.session).not.toHaveBeenCalled();
  });
});
