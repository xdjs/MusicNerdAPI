import { describe, it, expect, vi, beforeEach } from "vitest";

const claim = vi.fn();
const runResearchJob = vi.fn();
const fail = vi.fn();
const complete = vi.fn();
vi.mock("@/lib/research/completeResearchJob", () => ({
  completeResearchJob: (...a: unknown[]) => complete(...a),
}));
vi.mock("@/lib/research/claimResearchJob", () => ({
  claimResearchJob: (...a: unknown[]) => claim(...a),
}));
vi.mock("@/lib/research/runResearchJob", () => ({
  runResearchJob: (...a: unknown[]) => runResearchJob(...a),
}));
vi.mock("@/lib/research/failResearchJob", () => ({
  failResearchJob: (...a: unknown[]) => fail(...a),
}));

const { advanceResearch } = await import("@/lib/research/advanceResearch");
const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");

const job = { id: "job-1", artistId: "artist-1", kind: "social_ingest", cursor: 0, state: {} };

beforeEach(() => {
  claim.mockReset();
  runResearchJob.mockReset();
  fail.mockReset();
  complete.mockReset();
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
      kinds: [
        "social_ingest",
        "caption_extract",
        "lore_refresh",
        "source_search",
        "latest_refresh",
      ],
      artistId: "artist-1",
      excludeIds: ["x"],
    });
  });

  it("narrows the claim to the kinds the caller asks for", async () => {
    claim.mockResolvedValue(null);
    await advanceResearch({ budgetMs: 50_000, artistId: "artist-1", kinds: ["latest_refresh"] });
    expect(claim).toHaveBeenCalledWith({
      kinds: ["latest_refresh"],
      artistId: "artist-1",
      excludeIds: undefined,
    });
  });

  it("runs the claimed job inside the budget, less the persist reserve", async () => {
    claim.mockResolvedValue(job);
    runResearchJob.mockResolvedValue({
      progress: "scrape started (r)",
      done: false,
      waiting: true,
    });
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
    const deadline = runResearchJob.mock.calls[0][1];
    expect(deadline).toBeGreaterThanOrEqual(before + 45_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 45_000);
  });

  it("finishes quietly when the claim was revoked mid-job", async () => {
    claim.mockResolvedValue(job);
    runResearchJob.mockImplementationOnce(async () => {
      throw new OwnershipChangedError();
    });
    expect(await advanceResearch({ budgetMs: 50_000 })).toMatchObject({
      ran: true,
      done: true,
      progress: "Research cancelled after ownership changed",
    });
    expect(fail).not.toHaveBeenCalled();
    // The row can outlive the claim (a source search's claim changes under it).
    // Left running, it is reclaimed after every lease and blocks a replacement.
    expect(complete).toHaveBeenCalledWith("job-1");
  });

  it("records any other error on the job", async () => {
    claim.mockResolvedValue(job);
    runResearchJob.mockImplementationOnce(async () => {
      throw new Error("apify exploded");
    });
    expect(await advanceResearch({ budgetMs: 50_000 })).toMatchObject({
      ran: true,
      progress: "failed: apify exploded",
    });
    expect(fail).toHaveBeenCalledWith("job-1", "apify exploded");
  });
});

it("sets a failing Latest job aside for the rest of this cron tick", async () => {
  claim.mockResolvedValue({ ...job, kind: "latest_refresh" });
  runResearchJob.mockRejectedValue(new Error("apify status 503"));
  expect(await advanceResearch({ budgetMs: 55000 })).toMatchObject({ waiting: true });
  expect(fail).toHaveBeenCalledWith("job-1", "apify status 503");
});
