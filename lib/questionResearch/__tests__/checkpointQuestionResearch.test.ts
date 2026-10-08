import { it, expect, vi, beforeEach } from "vitest";
import { checkpointQuestionResearch } from "@/lib/questionResearch/checkpointQuestionResearch";
import type { ResearchJob } from "@/lib/research/types";
import type { QuestionResearchState } from "@/lib/questionResearch/types";
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  claim: vi.fn(),
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: mocks.lock }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mocks.claim }));
const state: QuestionResearchState = {
  version: 1,
  request: { topic: "Album credits", evidenceNeed: "credits", freshness: "stored" },
  key: "key",
  expectedClaimId: "claim",
  stage: "checking_saved",
  createdAt: new Date().toISOString(),
  references: [],
  limitations: [],
  modelCalls: 0,
  providerCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
};
const job = {
  id: "job",
  artistId: "artist",
  kind: "question_research",
  status: "running",
  cursor: 0,
  total: null,
  attempts: 0,
  state,
  updatedAt: "2026-10-06T00:00:00.000Z",
  activityId: null,
} as unknown as ResearchJob;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(fn => fn({ execute: mocks.execute }));
  mocks.claim.mockResolvedValue({ id: "claim" });
});
it("refuses a stale lease before doing any external work", async () => {
  mocks.execute.mockResolvedValue([]);
  expect(await checkpointQuestionResearch({ ...job }, state, false)).toBe(false);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
});
it("blocks late writes after claim replacement", async () => {
  mocks.claim.mockResolvedValue({ id: "replacement" });
  await expect(checkpointQuestionResearch({ ...job }, state, false)).rejects.toThrow();
  expect(mocks.execute).not.toHaveBeenCalled();
});
it("updates the in-memory lease from the committed database timestamp", async () => {
  mocks.execute
    .mockResolvedValueOnce([{ id: "job" }])
    .mockResolvedValueOnce([{ updated_at: "2026-10-06T00:00:01.000Z" }]);
  const current = { ...job };
  expect(await checkpointQuestionResearch(current, state, false)).toBe(true);
  expect(current.updatedAt).toBe("2026-10-06T00:00:01.000Z");
});
