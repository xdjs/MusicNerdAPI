import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  instagramHandleFor: vi.fn(),
  hasSocialPosts: vi.fn(),
  startInstagramScrape: vi.fn(),
  checkInstagramScrape: vi.fn(),
  collectInstagramScrape: vi.fn(),
  saveJobProgress: vi.fn(),
  saveJobState: vi.fn(),
  completeResearchJob: vi.fn(),
  failResearchJob: vi.fn(),
  enqueueResearchJob: vi.fn(),
}));
vi.mock("@/lib/instagram/instagramHandleFor", () => ({
  instagramHandleFor: (...a: unknown[]) => m.instagramHandleFor(...a),
}));
vi.mock("@/lib/instagram/hasSocialPosts", () => ({
  hasSocialPosts: (...a: unknown[]) => m.hasSocialPosts(...a),
}));
vi.mock("@/lib/instagram/startInstagramScrape", () => ({
  startInstagramScrape: (...a: unknown[]) => m.startInstagramScrape(...a),
}));
vi.mock("@/lib/instagram/checkInstagramScrape", () => ({
  checkInstagramScrape: (...a: unknown[]) => m.checkInstagramScrape(...a),
}));
vi.mock("@/lib/instagram/collectInstagramScrape", () => ({
  collectInstagramScrape: (...a: unknown[]) => m.collectInstagramScrape(...a),
}));
vi.mock("@/lib/research/saveJobProgress", () => ({
  saveJobProgress: (...a: unknown[]) => m.saveJobProgress(...a),
}));
vi.mock("@/lib/research/saveJobState", () => ({
  saveJobState: (...a: unknown[]) => m.saveJobState(...a),
}));
vi.mock("@/lib/research/completeResearchJob", () => ({
  completeResearchJob: (...a: unknown[]) => m.completeResearchJob(...a),
}));
vi.mock("@/lib/research/failResearchJob", () => ({
  failResearchJob: (...a: unknown[]) => m.failResearchJob(...a),
}));
vi.mock("@/lib/research/enqueueResearchJob", () => ({
  enqueueResearchJob: (...a: unknown[]) => m.enqueueResearchJob(...a),
}));
vi.mock("@/lib/social/runAdditionalSocialResearch", () => ({
  runAdditionalSocialResearch: vi.fn().mockResolvedValue(null),
}));

const { runIngest } = await import("@/lib/research/runIngest");

const job = (state: Record<string, unknown> = {}, cursor = 0) => ({
  id: "job-1",
  artistId: "artist-1",
  kind: "social_ingest" as const,
  status: "running" as const,
  cursor,
  total: null,
  attempts: 0,
  state,
  updatedAt: null,
  activityId: null,
});
const later = () => Date.now() + 55_000;

beforeEach(() => {
  Object.values(m).forEach(fn => fn.mockReset());
  m.instagramHandleFor.mockResolvedValue("biorritmo");
  m.hasSocialPosts.mockResolvedValue(false);
});

describe("runIngest", () => {
  it("fails closed on malformed job state before spending on any provider", async () => {
    await expect(
      runIngest(job("bad" as unknown as Record<string, unknown>), later()),
    ).rejects.toThrow("invalid social research state");
    expect(m.startInstagramScrape).not.toHaveBeenCalled();
  });
  it("retries a failed handle lookup instead of finishing", async () => {
    m.instagramHandleFor.mockResolvedValue("error");
    expect(await runIngest(job(), later())).toEqual({
      progress: "handle lookup failed, will retry",
      done: false,
    });
    expect(m.failResearchJob).toHaveBeenCalledWith("job-1", "could not read the artist's handle");
  });

  it("finishes an artist with no Instagram", async () => {
    m.instagramHandleFor.mockResolvedValue(null);
    expect(await runIngest(job(), later())).toEqual({
      progress: "no instagram handle",
      done: true,
    });
    expect(m.completeResearchJob).toHaveBeenCalledWith("job-1");
  });

  it("skips the scrape when posts exist and nobody forced a fresh look, then queues extraction", async () => {
    m.hasSocialPosts.mockResolvedValue(true);
    expect(await runIngest(job(), later())).toEqual({
      progress: "posts already present",
      done: true,
    });
    expect(m.startInstagramScrape).not.toHaveBeenCalled();
    expect(m.enqueueResearchJob).toHaveBeenCalledWith("artist-1", "caption_extract", {
      parentJobId: "job-1",
      state: {},
    });
  });

  it("starts a scrape, saves its run id first, and waits", async () => {
    m.startInstagramScrape.mockResolvedValue({ status: "started", runId: "run-1" });
    expect(await runIngest(job(), later())).toEqual({
      progress: "scrape started (run-1)",
      done: false,
      waiting: true,
    });
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 0, { state: { apifyRunId: "run-1" } });
  });

  it("scrapes again when forced even though posts exist", async () => {
    m.hasSocialPosts.mockResolvedValue(true);
    m.startInstagramScrape.mockResolvedValue({ status: "started", runId: "run-2" });
    await runIngest(job({ force: true }), later());
    expect(m.startInstagramScrape).toHaveBeenCalledWith("biorritmo");
  });

  it("fails the attempt when the scrape does not start", async () => {
    m.startInstagramScrape.mockResolvedValue({ status: "failed", reason: "apify start 402" });
    expect(await runIngest(job(), later())).toMatchObject({ done: false });
    expect(m.failResearchJob).toHaveBeenCalledWith("job-1", "apify start 402");
  });

  it("keeps waiting while the run is still going", async () => {
    m.checkInstagramScrape.mockResolvedValue({ status: "running", runId: "run-1" });
    expect(await runIngest(job({ apifyRunId: "run-1" }), later())).toEqual({
      progress: "scrape still running",
      done: false,
      waiting: true,
    });
  });

  it("fails the attempt when the run failed", async () => {
    m.checkInstagramScrape.mockResolvedValue({ status: "failed", reason: "apify run ABORTED" });
    await runIngest(job({ apifyRunId: "run-1" }), later());
    expect(m.failResearchJob).toHaveBeenCalledWith("job-1", "apify run ABORTED");
  });

  it("defers collection to a slice with a full thumbnail budget", async () => {
    m.checkInstagramScrape.mockResolvedValue({ status: "ready", runId: "run-1", datasetId: "ds" });
    expect(await runIngest(job({ apifyRunId: "run-1" }), Date.now() + 10_000)).toMatchObject({
      waiting: true,
      progress: "Waiting for a full thumbnail collection budget",
    });
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 0, {
      state: { apifyRunId: "run-1", apifyDatasetId: "ds", instagramHandle: "biorritmo" },
    });
    expect(m.collectInstagramScrape).not.toHaveBeenCalled();
  });

  it("stores a batch and saves the cursor while posts remain", async () => {
    m.checkInstagramScrape.mockResolvedValue({ status: "ready", runId: "run-1", datasetId: "ds" });
    m.collectInstagramScrape.mockResolvedValue({
      ingested: 9,
      ownPosts: 9,
      collabPosts: 0,
      nextCursor: 9,
    });
    expect(await runIngest(job({ apifyRunId: "run-1" }), later())).toMatchObject({
      progress: "Stored posts and thumbnails through 9",
      done: false,
    });
    expect(m.collectInstagramScrape).toHaveBeenCalledWith(
      "artist-1",
      "biorritmo",
      "ds",
      "job-1",
      0,
    );
  });

  it("resumes from the saved dataset without polling Apify again", async () => {
    m.collectInstagramScrape.mockResolvedValue({ ingested: 2, ownPosts: 2, collabPosts: 0 });
    const state = { apifyRunId: "run-1", apifyDatasetId: "ds", instagramHandle: "biorritmo" };
    expect(await runIngest(job(state, 18), later())).toEqual({
      progress: "ingested 20 post(s)",
      done: true,
    });
    expect(m.checkInstagramScrape).not.toHaveBeenCalled();
    expect(m.instagramHandleFor).not.toHaveBeenCalled();
    expect(m.completeResearchJob).toHaveBeenCalledWith("job-1");
    expect(m.enqueueResearchJob).toHaveBeenCalledWith("artist-1", "caption_extract", {
      parentJobId: "job-1",
      state: {},
    });
  });

  it("queues an incremental extraction after a forced scrape", async () => {
    m.collectInstagramScrape.mockResolvedValue({ ingested: 1, ownPosts: 1, collabPosts: 0 });
    const state = {
      force: true,
      apifyRunId: "r",
      apifyDatasetId: "ds",
      instagramHandle: "biorritmo",
    };
    await runIngest(job(state), later());
    expect(m.enqueueResearchJob.mock.calls[0][2]).toEqual({
      parentJobId: "job-1",
      state: { incremental: true },
    });
  });

  it("keeps the dataset and retries when collection fails", async () => {
    m.checkInstagramScrape.mockResolvedValue({ status: "ready", runId: "run-1", datasetId: "ds" });
    m.collectInstagramScrape.mockResolvedValue(null);
    expect(await runIngest(job({ apifyRunId: "run-1" }), later())).toEqual({
      progress: "collection failed, will retry",
      done: false,
    });
    expect(m.saveJobState).toHaveBeenCalledWith("job-1", {
      apifyRunId: "run-1",
      apifyDatasetId: "ds",
      instagramHandle: "biorritmo",
    });
    expect(m.failResearchJob).toHaveBeenCalledWith(
      "job-1",
      "could not collect the finished scrape",
    );
  });
});
