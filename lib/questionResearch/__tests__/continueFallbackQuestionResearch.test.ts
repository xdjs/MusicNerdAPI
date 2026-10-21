import { beforeEach, expect, it, vi } from "vitest";
import { continueFallbackQuestionResearch } from "@/lib/questionResearch/continueFallbackQuestionResearch";
const m = vi.hoisted(() => ({
  execute: vi.fn(),
  queue: vi.fn(),
  status: vi.fn(),
  bind: vi.fn(),
  register: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
vi.mock("@/lib/questionResearch/queueQuestionResearch", () => ({ queueQuestionResearch: m.queue }));
vi.mock("@/lib/questionResearch/getQuestionResearchStatus", () => ({
  getQuestionResearchStatus: m.status,
}));
vi.mock("@/lib/questionResearch/bindQuestionRequest", () => ({ bindQuestionRequest: m.bind }));
vi.mock("@/lib/questionResearch/registerResearchQuestion", () => ({
  registerResearchQuestion: m.register,
}));
const artistId = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222",
  nextJobId = "33333333-3333-4333-8333-333333333333";
const input = {
  artistId,
  jobId,
  question: "Where did they record it?",
  signal: new AbortController().signal,
};
const routing = {
  topic: "Recording location",
  evidenceNeed: "reporting",
  freshness: "stored",
  retrieval: "relevance",
  answerScope: "focused",
  reuseFallbackJobId: jobId,
};
const row = { request_hash: "a".repeat(64), answer_intent: "Recording location", routing };
const status = {
  status: "ok",
  jobId: nextJobId,
  stage: "checking_saved",
  provider: null,
  message: "Checking Lore",
  updatedAt: "2026-10-15",
  references: [],
  limitations: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.execute.mockResolvedValue([row]);
  m.queue.mockResolvedValue(status);
  m.status.mockResolvedValue(status);
  m.register.mockResolvedValue(true);
});
it("continues the admitted routing once, as the service, after reused originals miss", async () => {
  expect(await continueFallbackQuestionResearch(input)).toMatchObject({
    jobId: nextJobId,
    stage: "checking_saved",
  });
  expect(m.queue).toHaveBeenCalledWith(
    artistId,
    { kind: "service" },
    expect.not.objectContaining({ reuseFallbackJobId: expect.anything() }),
  );
  expect(m.register).toHaveBeenCalledWith(artistId, nextJobId, input.question);
  expect(m.bind).toHaveBeenCalledWith(
    expect.objectContaining({
      jobId: nextJobId,
      requestHash: row.request_hash,
      question: input.question,
      routing: expect.objectContaining({ reuseFallbackJobId: jobId }),
    }),
  );
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("does not start work for an absent, expired or already leased semantic handoff", async () => {
  m.execute.mockResolvedValue([]);
  expect(await continueFallbackQuestionResearch(input)).toBeNull();
  expect(m.queue).not.toHaveBeenCalled();
});
it("rejects unknown saved routing rather than accepting client hints", async () => {
  m.execute.mockResolvedValue([
    { ...row, routing: { ...routing, privateMemory: "not permitted" } },
  ]);
  await expect(continueFallbackQuestionResearch(input)).rejects.toThrow();
  expect(m.queue).not.toHaveBeenCalled();
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("does not loop when the ordinary research request resolves to the same saved job", async () => {
  m.queue.mockResolvedValue({ ...status, jobId });
  expect(await continueFallbackQuestionResearch(input)).toBeNull();
  expect(m.register).not.toHaveBeenCalled();
});
it("retains ordinary per-job registration limits and releases the short lease on failure", async () => {
  m.register.mockResolvedValue(false);
  await expect(continueFallbackQuestionResearch(input)).rejects.toMatchObject({ status: 429 });
  expect(m.bind).not.toHaveBeenCalled();
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("shares an in-flight continuation instead of returning a false absence or starting another plan", async () => {
  m.execute
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ job_id: jobId, busy: true }]);
  expect(await continueFallbackQuestionResearch(input)).toEqual({ pending: true });
  expect(m.queue).not.toHaveBeenCalled();
});
it("reconnects to the already bound continuation rather than requeueing it", async () => {
  m.execute
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ job_id: nextJobId, busy: false }]);
  expect(await continueFallbackQuestionResearch(input)).toMatchObject({ jobId: nextJobId });
  expect(m.status).toHaveBeenCalledWith(artistId, nextJobId, { kind: "service" });
  expect(m.register).not.toHaveBeenCalled();
});
it("refuses saved routing the research endpoint would refuse, without queueing", async () => {
  m.execute.mockResolvedValue([
    { ...row, routing: { ...routing, targetUrl: "http://192.168.0.1/session" } },
  ]);
  await expect(continueFallbackQuestionResearch(input)).rejects.toMatchObject({ status: 400 });
  expect(m.queue).not.toHaveBeenCalled();
});
