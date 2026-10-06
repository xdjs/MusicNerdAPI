import { it, expect, vi, beforeEach } from "vitest";
import { queueQuestionResearch } from "@/lib/questionResearch/queueQuestionResearch";
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  lock: vi.fn(),
  auth: vi.fn(),
  claim: vi.fn(),
  activity: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: mocks.lock }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({
  authorizeArtistKnowledge: mocks.auth,
}));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mocks.claim }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: mocks.activity }));
const request = {
  topic: "Album credits",
  evidenceNeed: "credits" as const,
  freshness: "stored" as const,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(fn => fn({ execute: mocks.execute }));
  mocks.claim.mockResolvedValue(null);
  mocks.activity.mockResolvedValue("event");
});
it("reserves quotas and persists queued acknowledgement without provider work", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ global: 0, artist: 0 }])
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
it("reuses the exact active request before spending another quota slot", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([
      {
        id: "job",
        status: "pending",
        state: { key: "existing" },
        updated_at: new Date().toISOString(),
      },
    ]);
  await expect(queueQuestionResearch("artist", { kind: "service" }, request)).rejects.toMatchObject(
    { status: 429 },
  );
  expect(mocks.activity).not.toHaveBeenCalled();
});
it("fails closed at the durable global quota", async () => {
  mocks.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "artist" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ global: 100, artist: 0 }]);
  await expect(queueQuestionResearch("artist", { kind: "service" }, request)).rejects.toMatchObject(
    { status: 429, code: "research_quota" },
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
