import { it, expect, vi, beforeEach } from "vitest";
import { queueQuestionResearch } from "@/lib/questionResearch/queueQuestionResearch";
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  lock: vi.fn(),
  auth: vi.fn(),
  claim: vi.fn(),
  activity: vi.fn(),
  transaction: vi.fn(),
  budget: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: mocks.lock }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({
  authorizeArtistKnowledge: mocks.auth,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mocks.claim }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: mocks.activity }));
vi.mock("@/lib/questionResearch/getQuestionResearchBudget", () => ({
  getQuestionResearchBudget: mocks.budget,
}));
const request = {
  topic: "Album credits",
  evidenceNeed: "credits" as const,
  freshness: "stored" as const,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(fn => fn({ execute: mocks.execute }));
  mocks.claim.mockResolvedValue(null);
  mocks.budget.mockResolvedValue({ saved: null, outside: null });
  mocks.activity.mockResolvedValue("event");
});
it("reserves quotas and persists queued acknowledgement without provider work", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "job", updated_at: new Date().toISOString() }]);
  const result = await queueQuestionResearch("artist", { kind: "service" }, request);
  expect(result).toMatchObject({
    jobId: "job",
    reused: false,
    stage: "checking_saved",
    references: [],
  });
  expect(mocks.activity).toHaveBeenCalledWith(
    "artist",
    "question_research",
    expect.objectContaining({ actorKind: "system" }),
    expect.anything(),
  );
});
it("rejects a different request while the artist already has active work", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "job" }]);
  await expect(queueQuestionResearch("artist", { kind: "service" }, request)).rejects.toMatchObject(
    { status: 429 },
  );
  expect(mocks.activity).not.toHaveBeenCalled();
});
it("fails closed when the shared saved-admission quota is exhausted", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  mocks.budget.mockResolvedValue({
    saved: { quotaScope: "saved_global", resetAt: "2026-10-16T12:00:00Z", retryAfterSeconds: 3600 },
    outside: null,
  });
  await expect(queueQuestionResearch("artist", { kind: "service" }, request)).rejects.toMatchObject(
    { status: 429, code: "saved_evidence_quota" },
  );
  expect(mocks.activity).not.toHaveBeenCalled();
});
it("rechecks current private authorization in the locked transaction", async () => {
  mocks.auth.mockRejectedValue(new Error("claim revoked"));
  mocks.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "artist" }]);
  await expect(
    queueQuestionResearch("artist", { kind: "artist", userId: "user" }, request),
  ).rejects.toThrow("claim revoked");
  expect(mocks.activity).not.toHaveBeenCalled();
});
it("admits saved-source research without reserving outside capacity", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "job", updated_at: new Date().toISOString() }]);
  const result = await queueQuestionResearch("artist", { kind: "service" }, request);
  expect(result).toMatchObject({ stage: "checking_saved" });
  expect(result).not.toHaveProperty("outsideResearchReason");
});
