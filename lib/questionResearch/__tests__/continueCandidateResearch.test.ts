import { beforeEach, expect, it, vi } from "vitest";
import { continueCandidateResearch } from "@/lib/questionResearch/continueCandidateResearch";
const m = vi.hoisted(() => ({ execute: vi.fn(), continue: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
vi.mock("@/lib/questionResearch/continueQuestionResearch", () => ({
  continueQuestionResearch: m.continue,
}));
const artistId = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
const input = {
  artistId,
  jobId,
  question: "Who played bass?",
  signal: new AbortController().signal,
};
const status = {
  status: "ok",
  jobId,
  selection: "research",
  stage: "checking_saved",
  provider: null,
  message: "Checking Lore",
  updatedAt: "2026-10-15",
  references: [],
  limitations: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.execute.mockResolvedValue([{ job_id: jobId }]);
  m.continue.mockResolvedValue(status);
});
it("continues the same job in process without registering another question or client routing", async () => {
  expect(await continueCandidateResearch(input)).toMatchObject({ jobId, selection: "research" });
  expect(m.continue).toHaveBeenCalledWith(artistId, jobId, { kind: "service" });
  expect(m.execute).toHaveBeenCalledTimes(3);
});
it("joins an active transition and does not overwrite an answer lease", async () => {
  m.execute.mockResolvedValueOnce([]);
  expect(await continueCandidateResearch(input)).toEqual({ pending: true });
  expect(m.continue).not.toHaveBeenCalled();
});
it("retains a recoverable transition when the continuation outcome is uncertain", async () => {
  m.continue.mockRejectedValue(new Error("Connection lost"));
  await expect(continueCandidateResearch(input)).rejects.toThrow();
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("does not erase the answer for an unrelated job or an unadvanced candidate", async () => {
  m.continue.mockResolvedValue({ ...status, selection: "candidates" });
  await expect(continueCandidateResearch(input)).rejects.toThrow("preserve its job");
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("does not treat a lost transition token as permission to overwrite newer work", async () => {
  m.execute.mockResolvedValueOnce([{ job_id: jobId }]).mockResolvedValueOnce([]);
  expect(await continueCandidateResearch(input)).toEqual({ pending: true });
});
