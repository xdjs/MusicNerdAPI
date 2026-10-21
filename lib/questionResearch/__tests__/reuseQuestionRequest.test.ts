import { beforeEach, expect, it, vi } from "vitest";
import { reuseQuestionRequest } from "@/lib/questionResearch/reuseQuestionRequest";
const m = vi.hoisted(() => ({ acquire: vi.fn(), status: vi.fn(), draft: vi.fn() }));
vi.mock("@/lib/questionResearch/acquireQuestionRequest", () => ({
  acquireQuestionRequest: m.acquire,
}));
vi.mock("@/lib/questionResearch/getQuestionResearchStatus", () => ({
  getQuestionResearchStatus: m.status,
}));
vi.mock("@/lib/questionResearch/getOrDraftResearchAnswer", () => ({
  getOrDraftResearchAnswer: m.draft,
}));
const artistId = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
const input = { artistId, artistName: "Example", question: "Who produced Glass Harbor?" };
const binding = {
  token: "old",
  job_id: jobId,
  question_hash: "a".repeat(64),
  reusable: true,
  busy: false,
};
const status = {
  status: "ok",
  jobId,
  stage: "complete",
  provider: null,
  message: "Complete",
  updatedAt: "2026-10-12",
  references: [],
  limitations: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  m.acquire.mockResolvedValueOnce({ state: "bound", binding });
  m.status.mockResolvedValue(status);
});
it("revalidates current originals in process, then only reads the bound verified answer hash", async () => {
  const result = {
    answer: "Ari produced it.",
    sources: [
      {
        n: 1,
        title: "Credits",
        url: "https://example.com/credits",
        sourceId: "vault:33333333-3333-4333-8333-333333333333",
        revision: "a".repeat(64),
        start: 0,
        end: 10,
        curation: "approved" as const,
        evidenceKind: "original_text" as const,
      },
    ],
    instagramMentions: [],
    fromOpenWeb: false,
    webDomains: [],
    suggestions: [],
  };
  m.draft.mockResolvedValue({ state: "ready", result });
  expect(await reuseQuestionRequest(input)).toMatchObject({ state: "ready", result });
  expect(m.status).toHaveBeenCalledWith(artistId, jobId, { kind: "service" });
  expect(m.draft).toHaveBeenCalledWith(
    expect.objectContaining({ jobId, readOnlyQuestionHash: binding.question_hash, references: [] }),
  );
  expect(m.acquire).toHaveBeenCalledTimes(1);
});
it.each(["unavailable", "unregistered"])(
  "replans on %s originals or abandoned answer rather than using or stranding it",
  async state => {
    m.draft.mockResolvedValue({ state });
    m.acquire.mockResolvedValueOnce({ state: "claimed", token: "new" });
    expect(await reuseQuestionRequest(input)).toMatchObject({ state: "claimed", token: "new" });
    expect(m.acquire).toHaveBeenLastCalledWith(artistId, expect.any(String), "old");
  },
);
it("reports active research as busy without starting another planner", async () => {
  m.status.mockResolvedValue({ ...status, stage: "checking_saved" });
  expect(await reuseQuestionRequest(input)).toMatchObject({ state: "busy" });
  expect(m.draft).not.toHaveBeenCalled();
});
it("does not serve a date-sensitive binding even if its old originals are still available", async () => {
  m.acquire
    .mockReset()
    .mockResolvedValueOnce({ state: "bound", binding: { ...binding, reusable: false } })
    .mockResolvedValueOnce({ state: "claimed", token: "new" });
  expect(await reuseQuestionRequest(input)).toMatchObject({ state: "claimed" });
  expect(m.draft).not.toHaveBeenCalled();
});
it("fails closed when eligibility cannot be read", async () => {
  m.status.mockRejectedValue(new Error("API down"));
  await expect(reuseQuestionRequest(input)).rejects.toThrow();
  expect(m.draft).not.toHaveBeenCalled();
});
