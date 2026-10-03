import { describe, it, expect, vi, beforeEach } from "vitest";
import { captionJob } from "@/lib/research/__tests__/captionJob";
import { numberedPost } from "@/lib/credits/__tests__/post";

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getSocialPostsOrNull: vi.fn(),
  resolveExtractionMode: vi.fn(),
  captionsToRead: vi.fn(),
  extractCaptionCredits: vi.fn(),
  appendSocialCredits: vi.fn(),
  sweepCaptionJob: vi.fn(),
  rebuildAfterCaptions: vi.fn(),
  saveJobProgress: vi.fn(),
  completeResearchJob: vi.fn(),
  failResearchJob: vi.fn(),
  failJobAtCursor: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({
  getArtistById: (...a: unknown[]) => m.findFirst(...a),
}));
vi.mock("@/lib/instagram/getSocialPostsOrNull", () => ({
  getSocialPostsOrNull: (...a: unknown[]) => m.getSocialPostsOrNull(...a),
}));
vi.mock("@/lib/research/resolveExtractionMode", () => ({
  resolveExtractionMode: (...a: unknown[]) => m.resolveExtractionMode(...a),
}));
vi.mock("@/lib/research/captionsToRead", () => ({
  captionsToRead: (...a: unknown[]) => m.captionsToRead(...a),
}));
vi.mock("@/lib/credits/extractCaptionCredits", () => ({
  extractCaptionCredits: (...a: unknown[]) => m.extractCaptionCredits(...a),
}));
vi.mock("@/lib/credits/appendSocialCredits", () => ({
  appendSocialCredits: (...a: unknown[]) => m.appendSocialCredits(...a),
}));
vi.mock("@/lib/research/sweepCaptionJob", () => ({
  sweepCaptionJob: (...a: unknown[]) => m.sweepCaptionJob(...a),
}));
vi.mock("@/lib/research/rebuildAfterCaptions", () => ({
  rebuildAfterCaptions: (...a: unknown[]) => m.rebuildAfterCaptions(...a),
}));
vi.mock("@/lib/research/saveJobProgress", () => ({
  saveJobProgress: (...a: unknown[]) => m.saveJobProgress(...a),
}));
vi.mock("@/lib/research/completeResearchJob", () => ({
  completeResearchJob: (...a: unknown[]) => m.completeResearchJob(...a),
}));
vi.mock("@/lib/research/failResearchJob", () => ({
  failResearchJob: (...a: unknown[]) => m.failResearchJob(...a),
}));
vi.mock("@/lib/research/failJobAtCursor", () => ({
  failJobAtCursor: (...a: unknown[]) => m.failJobAtCursor(...a),
}));
const { runCaptionExtract } = await import("@/lib/research/runCaptionExtract");

const posts = [numberedPost(1), { ...numberedPost(2), postedAt: "" }];
const artist = { name: "Bio Ritmo", instagram: "bioritmo" };
const slice = (over: Record<string, unknown> = {}) => ({
  extraction: { credits: [], statements: [] },
  nextBatch: 1,
  totalBatches: 1,
  done: true,
  failed: false,
  ...over,
});
const later = () => Date.now() + 55_000;

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.findFirst.mockResolvedValue(artist);
  m.getSocialPostsOrNull.mockResolvedValue(posts);
  m.resolveExtractionMode.mockResolvedValue(false);
  m.captionsToRead.mockImplementation(async (_j: unknown, p: unknown) => p);
  m.extractCaptionCredits.mockResolvedValue(slice());
  m.appendSocialCredits.mockResolvedValue(3);
  m.sweepCaptionJob.mockResolvedValue(null);
  m.rebuildAfterCaptions.mockResolvedValue({ progress: "complete, 1 batch(es)", done: true });
});

describe("runCaptionExtract", () => {
  it("rebuilds new audio context even when every caption was already read", async () => {
    m.resolveExtractionMode.mockResolvedValue(true);
    m.captionsToRead.mockResolvedValue([]);
    await runCaptionExtract(
      captionJob({ incremental: true, rebuildForVideoContext: true }),
      later(),
    );
    expect(m.rebuildAfterCaptions).toHaveBeenCalled();
    expect(m.extractCaptionCredits).not.toHaveBeenCalled();
  });
  it("completes when the artist is gone or has no posts", async () => {
    m.findFirst.mockResolvedValueOnce(undefined);
    expect(await runCaptionExtract(captionJob(), later())).toEqual({
      progress: "no artist",
      done: true,
    });
    m.getSocialPostsOrNull.mockResolvedValueOnce([]);
    expect(await runCaptionExtract(captionJob(), later())).toEqual({
      progress: "no posts",
      done: true,
    });
    expect(m.completeResearchJob).toHaveBeenCalledTimes(2);
  });

  it("fails and retries when the posts could not be read, which is not the same as none", async () => {
    m.getSocialPostsOrNull.mockResolvedValueOnce(null);
    expect(await runCaptionExtract(captionJob(), later())).toEqual({
      progress: "post lookup failed, will retry",
      done: false,
    });
    expect(m.failResearchJob).toHaveBeenCalledWith("job-1", "could not read stored posts");
    expect(m.completeResearchJob).not.toHaveBeenCalled();
  });

  it("completes an incremental job with nothing new to read", async () => {
    m.resolveExtractionMode.mockResolvedValueOnce(true);
    m.captionsToRead.mockResolvedValueOnce([]);
    expect(await runCaptionExtract(captionJob(), later())).toEqual({
      progress: "nothing new to read",
      done: true,
    });
    expect(m.extractCaptionCredits).not.toHaveBeenCalled();
  });

  it("reads from the job's cursor, stores with post dates (undated as null), and saves progress", async () => {
    m.extractCaptionCredits.mockResolvedValueOnce(
      slice({ done: false, nextBatch: 4, totalBatches: 25 }),
    );
    const job = captionJob({ mode: "full" }, 1);
    expect(await runCaptionExtract(job, later())).toEqual({
      progress: "batch 4/25, +3 row(s)",
      done: false,
    });
    expect(m.extractCaptionCredits).toHaveBeenCalledWith(posts, "Bio Ritmo", "bioritmo", {
      startBatch: 1,
      budgetMs: expect.any(Number),
    });
    const dated = m.appendSocialCredits.mock.calls[0][2] as Map<string, string | null>;
    expect(dated.get(posts[0].url)).toBe(posts[0].postedAt);
    expect(dated.get(posts[1].url)).toBeNull();
    expect(m.appendSocialCredits.mock.calls[0][3]).toBe("job-1");
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 4, {
      total: 25,
      state: { mode: "full" },
    });
  });

  it("holds the cursor when the credits could not be stored", async () => {
    m.appendSocialCredits.mockResolvedValueOnce(null);
    expect(await runCaptionExtract(captionJob(), later())).toEqual({
      progress: "storage failed, cursor held",
      done: false,
    });
    expect(m.failResearchJob).toHaveBeenCalledWith("job-1", "could not store extracted credits");
    expect(m.saveJobProgress).not.toHaveBeenCalled();
  });

  it("records a batch it could not read as a failed attempt at that cursor", async () => {
    m.extractCaptionCredits.mockResolvedValueOnce(
      slice({ failed: true, done: false, nextBatch: 2, totalBatches: 25 }),
    );
    const out = await runCaptionExtract(captionJob({ mode: "full" }), later());
    expect(out).toEqual({ progress: "read up to batch 2, will retry", done: false });
    expect(m.failJobAtCursor).toHaveBeenCalledWith(
      "job-1",
      2,
      25,
      { mode: "full" },
      "a caption batch could not be read",
    );
  });

  it("returns the sweep's outcome while it is unfinished", async () => {
    m.sweepCaptionJob.mockResolvedValueOnce({ progress: "sweeping, 1/2", done: false });
    expect(await runCaptionExtract(captionJob(), later())).toEqual({
      progress: "sweeping, 1/2",
      done: false,
    });
    expect(m.rebuildAfterCaptions).not.toHaveBeenCalled();
  });

  it("rebuilds the Lore once every batch is read and swept", async () => {
    const job = captionJob();
    const deadline = later();
    expect(await runCaptionExtract(job, deadline)).toEqual({
      progress: "complete, 1 batch(es)",
      done: true,
    });
    expect(m.sweepCaptionJob).toHaveBeenCalledWith(
      job,
      posts,
      artist,
      expect.any(Map),
      slice(),
      deadline,
    );
    expect(m.rebuildAfterCaptions).toHaveBeenCalledWith(job, slice(), deadline);
  });
});
