import { beforeEach, expect, it, vi } from "vitest";
import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";
import { postAskArtistHandler } from "@/lib/questionResearch/postAskArtistHandler";
const m = vi.hoisted(() => ({
  visitor: vi.fn(),
  candidateContinue: vi.fn(),
  fallbackContinue: vi.fn(),
  candidates: vi.fn(),
  release: vi.fn(),
  reuse: vi.fn(),
  bind: vi.fn(),
  reserve: vi.fn(),
  artist: vi.fn(),
  plan: vi.fn(),
  status: vi.fn(),
  queue: vi.fn(),
  draft: vi.fn(),
  register: vi.fn(),
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: m.visitor,
}));
vi.mock("@/lib/questionResearch/continueCandidateResearch", () => ({
  continueCandidateResearch: m.candidateContinue,
}));
vi.mock("@/lib/questionResearch/continueFallbackQuestionResearch", () => ({
  continueFallbackQuestionResearch: m.fallbackContinue,
}));
vi.mock("@/lib/questionResearch/listReusableQuestionCandidates", () => ({
  listReusableQuestionCandidates: m.candidates,
}));
vi.mock("@/lib/questionResearch/releaseQuestionRequest", () => ({
  releaseQuestionRequest: m.release,
}));
vi.mock("@/lib/questionResearch/reuseQuestionRequest", () => ({ reuseQuestionRequest: m.reuse }));
vi.mock("@/lib/questionResearch/bindQuestionRequest", () => ({ bindQuestionRequest: m.bind }));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: m.reserve,
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/planArtistQuestion", () => ({ planArtistQuestion: m.plan }));
vi.mock("@/lib/questionResearch/getQuestionResearchStatus", () => ({
  getQuestionResearchStatus: m.status,
}));
vi.mock("@/lib/questionResearch/queueDirectEvidenceResearch", () => ({
  queueDirectEvidenceResearch: m.queue,
}));
vi.mock("@/lib/questionResearch/getOrDraftResearchAnswer", () => ({
  getOrDraftResearchAnswer: m.draft,
}));
vi.mock("@/lib/questionResearch/registerResearchQuestion", () => ({
  registerResearchQuestion: m.register,
}));
const artistId = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
const status = {
  status: "ok",
  jobId,
  stage: "checking_saved",
  provider: null,
  message: "Checking saved originals",
  updatedAt: "2026-10-06",
  references: [],
  limitations: [],
};
const request = (extra = {}) =>
  new Request("https://api.example/api/askArtist", {
    method: "POST",
    body: JSON.stringify({ artistId, question: "Who played drums?", ...extra }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.visitor.mockResolvedValue("a".repeat(64));
  m.fallbackContinue.mockResolvedValue(null);
  m.candidates.mockResolvedValue([]);
  m.release.mockResolvedValue(undefined);
  m.reuse.mockResolvedValue({ state: "claimed", requestHash: "hash", token: "token" });
  m.artist.mockResolvedValue({ id: artistId, name: "Artist", bandcamp: "artist" });
  m.plan.mockResolvedValue({ topic: "drum credits", evidenceNeed: "credits", freshness: "stored" });
  m.status.mockResolvedValue(status);
  m.queue.mockResolvedValue(status);
  m.draft.mockResolvedValue({ state: "drafting" });
  m.register.mockResolvedValue(true);
});
it("acknowledges the durable job before any collection or answer call, with CORS and no-store", async () => {
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(202);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  const body = await r.json();
  expect(body.status).toBe("ok");
  expect(body.research).toMatchObject({
    jobId,
    resolvedQuestion: "Who played drums?",
    stage: "checking_saved",
  });
  expect(m.reserve).toHaveBeenCalledWith(artistId, "a".repeat(64));
  expect(m.queue).toHaveBeenCalledWith(artistId, {
    topic: "drum credits",
    evidenceNeed: "credits",
    freshness: "stored",
  });
  expect(m.status).not.toHaveBeenCalled();
  expect(m.register).toHaveBeenCalledWith(artistId, jobId, "Who played drums?");
  expect(m.bind).toHaveBeenCalledWith(
    expect.objectContaining({ jobId, reusable: true, requestHash: "hash", token: "token" }),
  );
  expect(m.draft).not.toHaveBeenCalled();
  expect(m.release).toHaveBeenCalledWith(artistId, "hash", "token");
});
it("resumes the known artist-scoped job without replanning, reserving or enqueueing", async () => {
  const r = await postAskArtistHandler(request({ jobId }));
  expect(r.status).toBe(202);
  expect(m.plan).not.toHaveBeenCalled();
  expect(m.reserve).not.toHaveBeenCalled();
  expect(m.reuse).not.toHaveBeenCalled();
  expect(m.queue).not.toHaveBeenCalled();
  expect(m.status).toHaveBeenCalledWith(artistId, jobId, { kind: "service" });
});
it("does not generate a guessed answer to an unresolved request", async () => {
  m.status.mockResolvedValue({ ...status, stage: "unresolved" });
  const r = await postAskArtistHandler(request({ jobId }));
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.answer).toMatch(/don't have enough information/i);
  expect(body.research).toMatchObject({ jobId, stage: "unresolved" });
  expect(m.draft).not.toHaveBeenCalled();
});
it("relays an outside-research quota on an unresolved job as a 200 with its code", async () => {
  m.status.mockResolvedValue({
    ...status,
    stage: "unresolved",
    outsideResearchReason: "quota",
    retryAfterSeconds: 600,
    resetAt: "2026-10-21T12:00:00.000Z",
  });
  const body = await (await postAskArtistHandler(request({ jobId }))).json();
  expect(body).toMatchObject({
    status: "ok",
    code: "research_quota",
    retryAfterSeconds: 600,
    retryFromStart: true,
  });
});
it("rejects invalid request scope before any model or research work", async () => {
  const r = await postAskArtistHandler(request({ artistId: "not-an-id" }));
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ status: "error", error: "Invalid artist or question" });
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.plan).not.toHaveBeenCalled();
});
it("answers 404 for an unknown artist and 503 for a storage failure", async () => {
  m.artist.mockRejectedValue(new KnowledgeError("not_found", 404, "Artist unavailable"));
  const missing = await postAskArtistHandler(request());
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ status: "error", error: "Artist not found" });
  m.artist.mockRejectedValue(new Error("private connection detail"));
  const down = await postAskArtistHandler(request());
  expect(down.status).toBe(503);
  expect(await down.text()).not.toContain("private connection detail");
});
it("does not leak details after a research failure, and releases the lease", async () => {
  m.queue.mockRejectedValue(new Error("private details"));
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("private details");
  expect(m.release).toHaveBeenCalledWith(artistId, "hash", "token");
});
it("maps research_busy and quota codes to 429 with their messages", async () => {
  m.queue.mockRejectedValue(new KnowledgeError("research_busy", 429, "PRIVATE"));
  const busy = await postAskArtistHandler(request());
  expect(busy.status).toBe(429);
  expect(await busy.json()).toEqual({
    status: "error",
    code: "research_busy",
    error: "Research is busy right now. Please try again shortly.",
  });
  m.plan.mockClear();
  m.reserve.mockRejectedValue(
    Object.assign(new Error("x"), {
      status: 429,
      code: "visitor_question_quota",
      retryAfterSeconds: 120,
      resetAt: "2026-10-21T12:00:00Z",
    }),
  );
  const quota = await postAskArtistHandler(request());
  expect(quota.status).toBe(429);
  expect(quota.headers.get("X-MusicNerd-Quota")).toBe("true");
  expect(quota.headers.get("Retry-After")).toBe("120");
  expect(await quota.json()).toMatchObject({
    status: "error",
    code: "visitor_question_quota",
    retryAfterSeconds: 120,
  });
  expect(m.plan).not.toHaveBeenCalled();
});
it("reports an identical running request as busy", async () => {
  m.reuse.mockResolvedValue({ state: "busy", requestHash: "hash" });
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(429);
  expect((await r.json()).code).toBe("research_busy");
  expect(m.reserve).not.toHaveBeenCalled();
});
it("returns a reused verified answer with bandcamp and limitations, without planning", async () => {
  m.reuse.mockResolvedValue({
    state: "ready",
    requestHash: "hash",
    result: {
      answer: "Ari. [1]",
      sources: [{ n: 1 }],
      instagramMentions: [],
      fromOpenWeb: false,
      webDomains: [],
      suggestions: [],
    },
    limitations: ["x"],
  });
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({
    status: "ok",
    answer: "Ari. [1]",
    bandcamp: "https://artist.bandcamp.com",
    limitations: ["x"],
  });
  expect(m.plan).not.toHaveBeenCalled();
  expect(m.release).not.toHaveBeenCalled();
});
it("returns the planner's clarification without research", async () => {
  m.plan.mockResolvedValue({ clarification: "Which song?" });
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({
    status: "ok",
    answer: "Which song?",
    sources: [],
    suggestions: [],
  });
  expect(m.queue).not.toHaveBeenCalled();
});
it("treats a cached complete acknowledgement as a job to reopen, never an evidence result", async () => {
  m.queue.mockResolvedValue({
    ...status,
    stage: "complete",
    limitations: ["Read current job status to obtain revalidated evidence."],
  });
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(202);
  expect((await r.json()).research.jobId).toBe(jobId);
  expect(m.draft).not.toHaveBeenCalled();
});
it("refuses a fourth question on a saved job with Web's 429", async () => {
  m.register.mockResolvedValue(false);
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(429);
  expect(await r.json()).toEqual({
    status: "error",
    error: "This saved research has reached its answer limit. Try a different question later.",
  });
});
it("returns checked saved results without invoking the model in the route", async () => {
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  m.draft.mockResolvedValue({
    state: "ready",
    result: {
      answer: "They played drums. [1]",
      sources: [{ n: 1 }],
      instagramMentions: [],
      fromOpenWeb: false,
      webDomains: [],
      suggestions: [],
    },
  });
  const r = await postAskArtistHandler(request({ jobId }));
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({
    status: "ok",
    answer: "They played drums. [1]",
    bandcamp: "https://artist.bandcamp.com",
  });
  expect(m.draft).toHaveBeenCalledWith(expect.objectContaining({ jobId, artistId }));
});
it("tells concurrent pollers the checked answer is still being prepared", async () => {
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  const r = await postAskArtistHandler(request({ jobId }));
  expect(r.status).toBe(202);
  expect((await r.json()).research.message).toMatch(/checking/i);
});
it("returns a safe verification stage and retry boundary", async () => {
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  m.draft.mockResolvedValue({ state: "failed", stage: "claim_check", retryable: true });
  const r = await postAskArtistHandler(request({ jobId }));
  expect(r.status).toBe(503);
  expect(await r.json()).toMatchObject({
    status: "error",
    jobId,
    verification: { stage: "claim_check", retryable: true },
  });
});
it("rejects an unregistered completed-job question before drafting", async () => {
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  m.draft.mockResolvedValue({ state: "unregistered" });
  const r = await postAskArtistHandler(request({ jobId, question: "A different question?" }));
  expect(r.status).toBe(409);
});
it("reports a failed or cancelled job as a restart, and an unavailable source honestly", async () => {
  m.status.mockResolvedValue({ ...status, stage: "failed" });
  const failed = await postAskArtistHandler(request({ jobId }));
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({
    status: "error",
    error: "I couldn't finish that lookup. Please try again.",
    retryFromStart: true,
  });
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  m.draft.mockResolvedValue({ state: "unavailable" });
  const gone = await postAskArtistHandler(request({ jobId }));
  expect(gone.status).toBe(200);
  expect((await gone.json()).research).toMatchObject({
    stage: "unresolved",
    message: "Source access changed.",
  });
});
it("continues a candidate miss on the same job and a semantic miss on the saved plan", async () => {
  m.status.mockResolvedValue({ ...status, stage: "complete", selection: "candidates" });
  m.draft.mockResolvedValue({ state: "continuing" });
  m.candidateContinue.mockResolvedValue({ ...status, selection: "research" });
  const candidate = await postAskArtistHandler(request({ jobId }));
  expect(candidate.status).toBe(202);
  expect((await candidate.json()).research).toMatchObject({
    jobId,
    stage: "checking_saved",
    message: "Checking Lore…",
  });
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  m.draft.mockResolvedValue({
    state: "ready",
    result: {
      answer: "x",
      sources: [],
      instagramMentions: [],
      fromOpenWeb: false,
      webDomains: [],
      suggestions: [],
    },
  });
  m.fallbackContinue.mockResolvedValue({
    ...status,
    jobId: "33333333-3333-4333-8333-333333333333",
  });
  const semantic = await postAskArtistHandler(request({ jobId }));
  expect(semantic.status).toBe(202);
  expect((await semantic.json()).research.jobId).toBe("33333333-3333-4333-8333-333333333333");
});
it("checks a compatible saved answer against a complete candidate job before new research", async () => {
  const candidate = {
    id: `${jobId}:h`,
    jobId,
    questionHash: "h",
    intent: "Drum credit",
    routing: { evidenceNeed: "credits", freshness: "stored" },
    answer: "x",
    passages: [],
  };
  m.candidates.mockResolvedValue([candidate]);
  m.plan.mockResolvedValue({
    topic: "drum credits",
    evidenceNeed: "credits",
    freshness: "stored",
    answerIntent: "Drum credit",
    reuseCandidateId: candidate.id,
    reuseAction: "same_answer",
  });
  m.status.mockResolvedValue({ ...status, stage: "complete" });
  m.draft.mockResolvedValue({
    state: "ready",
    result: {
      answer: "x",
      sources: [{ n: 1 }],
      instagramMentions: [],
      fromOpenWeb: false,
      webDomains: [],
      suggestions: [],
    },
  });
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(202);
  expect((await r.json()).research).toMatchObject({
    jobId,
    stage: "complete",
    message: "Checking the sourced answer…",
  });
  expect(m.draft).toHaveBeenCalledWith(expect.objectContaining({ readOnlyQuestionHash: "h" }));
  expect(m.bind).toHaveBeenCalledWith(
    expect.objectContaining({ routing: expect.objectContaining({ reuseFallbackJobId: jobId }) }),
  );
  expect(m.queue).not.toHaveBeenCalled();
});
it("refuses planner routing the research endpoint would refuse, without queueing", async () => {
  m.plan.mockResolvedValue({ topic: "x", evidenceNeed: "credits", freshness: "stored" });
  const r = await postAskArtistHandler(request());
  expect(r.status).toBe(503);
  expect(await r.json()).toEqual({
    status: "error",
    error: "Research is temporarily unavailable. Please try again.",
  });
  expect(m.queue).not.toHaveBeenCalled();
});
it("answers an unreadable body or a visitor-key database error with a JSON 503 and CORS", async () => {
  const broken = new Request("https://api.example/api/askArtist", {
    method: "POST",
    body: new ReadableStream({ pull: c => c.error(new Error("socket hang up")) }),
    duplex: "half",
  } as RequestInit);
  const unreadable = await postAskArtistHandler(broken);
  expect(unreadable.status).toBe(503);
  expect(unreadable.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await unreadable.json()).toMatchObject({ status: "error" });
  m.visitor.mockRejectedValue(new Error("connection refused"));
  const down = await postAskArtistHandler(request());
  expect(down.status).toBe(503);
  expect(down.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await down.json()).toEqual({
    status: "error",
    error: "Research is temporarily unavailable. Please try again.",
  });
});
