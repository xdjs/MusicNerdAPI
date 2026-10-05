import { it, expect, vi, beforeEach } from "vitest";
import { runSourceExtraction } from "@/lib/sourceExtraction/runSourceExtraction";
const m = vi.hoisted(() => ({ fetch: vi.fn(), checkpoint: vi.fn() }));
vi.mock("@/lib/sourceExtraction/fetchSourceText", () => ({ fetchSourceText: m.fetch }));
vi.mock("@/lib/sourceExtraction/checkpointSourceExtraction", () => ({
  checkpointSourceExtraction: m.checkpoint,
}));
const id = "11111111-1111-4111-8111-111111111111";
const job = {
  id,
  artistId: id,
  kind: "source_extract" as const,
  status: "running" as const,
  cursor: 0,
  total: 2,
  attempts: 0,
  state: {
    version: 1,
    userId: id,
    expectedClaimId: null,
    sources: [
      { id, url: "https://first.example" },
      { id: "22222222-2222-4222-8222-222222222222", url: "https://second.example" },
    ],
    outcomes: [],
  },
  updatedAt: null,
  activityId: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.fetch.mockResolvedValue({
    status: "empty",
    capturedAt: "2026-10-05T00:00:00.000Z",
    httpStatus: 200,
    truncated: false,
  });
  m.checkpoint.mockResolvedValue({ done: false, progress: "1/2" });
});
it("attempts one source then checkpoints before another slice", async () => {
  await runSourceExtraction(job, Date.now() + 30_000);
  expect(m.fetch).toHaveBeenCalledOnce();
  expect(m.fetch).toHaveBeenCalledWith("https://first.example", 15_000);
  expect(m.checkpoint).toHaveBeenCalledWith(job, job.state, await m.fetch.mock.results[0].value);
});
it("resumes the next source from persisted state after a restart", async () => {
  const resumed = {
    ...job,
    cursor: 1,
    state: {
      ...job.state,
      outcomes: [
        {
          sourceId: id,
          status: "empty",
          capturedAt: "2026-10-05T00:00:00.000Z",
          httpStatus: 200,
          storedChars: 0,
          truncated: false,
        },
      ],
    },
  };
  await runSourceExtraction(resumed, Date.now() + 30_000);
  expect(m.fetch).toHaveBeenCalledWith("https://second.example", 15_000);
});
it("returns the lease without fetching when the budget is spent", async () => {
  await runSourceExtraction(job, Date.now() - 1);
  expect(m.fetch).not.toHaveBeenCalled();
  expect(m.checkpoint).toHaveBeenCalledWith(job, job.state, null);
});
it("does not guess from a corrupted cursor/state", async () => {
  await expect(runSourceExtraction({ ...job, cursor: 1 }, Date.now() + 30_000)).rejects.toThrow(
    "Invalid source extraction state",
  );
  expect(m.fetch).not.toHaveBeenCalled();
});
it("never bubbles raw SQL, original text or a source URL into job error logs", async () => {
  m.checkpoint.mockRejectedValue(
    new Error("SQL params: private original, https://source.example?secret=x"),
  );
  await expect(runSourceExtraction(job, Date.now() + 30_000)).rejects.toThrow(
    "Source extraction persistence unavailable",
  );
});
