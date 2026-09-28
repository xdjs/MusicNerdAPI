import { describe, it, expect, vi, beforeEach } from "vitest";

const claim = vi.fn();
const runIngest = vi.fn();
const fail = vi.fn();
vi.mock("@/lib/research/claimResearchJob", () => ({
  claimResearchJob: (...a: unknown[]) => claim(...a),
}));
vi.mock("@/lib/research/runIngest", () => ({ runIngest: (...a: unknown[]) => runIngest(...a) }));
vi.mock("@/lib/research/failResearchJob", () => ({
  failResearchJob: (...a: unknown[]) => fail(...a),
}));

const { advanceResearch } = await import("@/lib/research/advanceResearch");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const job = { id: "job-1", artistId: "artist-1", kind: "social_ingest", cursor: 0, state: {} };

beforeEach(() => {
  claim.mockReset();
  runIngest.mockReset();
  fail.mockReset();
});

describe("advanceResearch", () => {
  it("reports an empty queue as ran: false", async () => {
    claim.mockResolvedValue(null);
    expect(await advanceResearch({ budgetMs: 50_000 })).toEqual({ ran: false });
  });

  it("claims only the kinds this API runs, scoped and skipping as asked", async () => {
    claim.mockResolvedValue(null);
    await advanceResearch({ budgetMs: 50_000, artistId: "artist-1", excludeJobIds: ["x"] });
    expect(claim).toHaveBeenCalledWith({
      kinds: ["social_ingest"],
      artistId: "artist-1",
      excludeIds: ["x"],
    });
  });

  it("runs the claimed job inside the budget, less the persist reserve", async () => {
    claim.mockResolvedValue(job);
    runIngest.mockResolvedValue({ progress: "scrape started (r)", done: false, waiting: true });
    const before = Date.now();
    const result = await advanceResearch({ budgetMs: 50_000 });
    expect(result).toEqual({
      ran: true,
      jobId: "job-1",
      kind: "social_ingest",
      artistId: "artist-1",
      progress: "scrape started (r)",
      done: false,
      waiting: true,
    });
    const deadline = runIngest.mock.calls[0][1];
    expect(deadline).toBeGreaterThanOrEqual(before + 45_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 45_000);
  });

  it("finishes quietly when the claim was revoked mid-job", async () => {
    claim.mockResolvedValue(job);
    runIngest.mockImplementationOnce(async () => {
      throw new OwnershipChangedError();
    });
    expect(await advanceResearch({ budgetMs: 50_000 })).toMatchObject({
      ran: true,
      done: true,
      progress: "Research cancelled after ownership changed",
    });
    expect(fail).not.toHaveBeenCalled();
  });

  it("records any other error on the job", async () => {
    claim.mockResolvedValue(job);
    runIngest.mockImplementationOnce(async () => {
      throw new Error("apify exploded");
    });
    expect(await advanceResearch({ budgetMs: 50_000 })).toMatchObject({
      ran: true,
      progress: "failed: apify exploded",
    });
    expect(fail).toHaveBeenCalledWith("job-1", "apify exploded");
  });
});
