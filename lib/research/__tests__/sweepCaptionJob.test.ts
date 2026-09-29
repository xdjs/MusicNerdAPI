import { describe, it, expect, vi, beforeEach } from "vitest";
import { captionJob } from "@/lib/research/__tests__/captionJob";
import { numberedPost } from "@/lib/credits/__tests__/post";

const m = vi.hoisted(() => ({
  claimedSourceUrls: vi.fn(),
  sweepSilentCaptions: vi.fn(),
  appendSocialCredits: vi.fn(),
  saveJobProgress: vi.fn(),
  failResearchJob: vi.fn(),
  failJobAtCursor: vi.fn(),
}));
vi.mock("@/lib/credits/claimedSourceUrls", () => ({
  claimedSourceUrls: (...a: unknown[]) => m.claimedSourceUrls(...a),
}));
vi.mock("@/lib/credits/sweepSilentCaptions", () => ({
  sweepSilentCaptions: (...a: unknown[]) => m.sweepSilentCaptions(...a),
}));
vi.mock("@/lib/credits/appendSocialCredits", () => ({
  appendSocialCredits: (...a: unknown[]) => m.appendSocialCredits(...a),
}));
vi.mock("@/lib/research/saveJobProgress", () => ({
  saveJobProgress: (...a: unknown[]) => m.saveJobProgress(...a),
}));
vi.mock("@/lib/research/failResearchJob", () => ({
  failResearchJob: (...a: unknown[]) => m.failResearchJob(...a),
}));
vi.mock("@/lib/research/failJobAtCursor", () => ({
  failJobAtCursor: (...a: unknown[]) => m.failJobAtCursor(...a),
}));
const { sweepCaptionJob } = await import("@/lib/research/sweepCaptionJob");

const posts = [1, 2].map(numberedPost);
const artist = { name: "Bio Ritmo", instagram: "bioritmo" };
const dated = new Map<string, string | null>();
const read = {
  extraction: { credits: [], statements: [] },
  nextBatch: 25,
  totalBatches: 25,
  done: true,
};
const swept = (over: Record<string, unknown> = {}) => ({
  extraction: { credits: [], statements: [] },
  nextBatch: 2,
  totalBatches: 2,
  done: true,
  ...over,
});
const later = () => Date.now() + 50_000;

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.claimedSourceUrls.mockResolvedValue(new Set(["claimed"]));
  m.appendSocialCredits.mockResolvedValue(0);
});

describe("sweepCaptionJob", () => {
  it("is nothing to do once the job has swept", async () => {
    expect(
      await sweepCaptionJob(captionJob({ swept: true }), posts, artist, dated, read, later()),
    ).toBeNull();
    expect(m.sweepSilentCaptions).not.toHaveBeenCalled();
  });

  it("defers the sweep to the next slice when under 15 s are left", async () => {
    const job = captionJob({ mode: "full" });
    const out = await sweepCaptionJob(job, posts, artist, dated, read, Date.now() + 10_000);
    expect(out).toEqual({
      progress: "batches done, sweep deferred to the next slice",
      done: false,
    });
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 25, {
      total: 25,
      state: { mode: "full" },
    });
    expect(m.sweepSilentCaptions).not.toHaveBeenCalled();
  });

  it("sweeps from the saved cursor, stores what it finds, and marks the job swept", async () => {
    m.sweepSilentCaptions.mockResolvedValueOnce(swept());
    const job = captionJob({ mode: "full", sweepCursor: 3 });
    expect(await sweepCaptionJob(job, posts, artist, dated, read, later())).toBeNull();
    expect(m.sweepSilentCaptions).toHaveBeenCalledWith(
      posts,
      new Set(["claimed"]),
      "Bio Ritmo",
      "bioritmo",
      {
        budgetMs: expect.any(Number),
        startBatch: 3,
      },
    );
    expect(m.appendSocialCredits).toHaveBeenCalledWith(
      "artist-1",
      expect.any(Object),
      dated,
      "job-1",
    );
    expect(job.state.swept).toBe(true);
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 25, { total: 25, state: job.state });
  });

  it("carries an unfinished sweep's cursor to the next slice", async () => {
    m.sweepSilentCaptions.mockResolvedValueOnce(swept({ done: false, nextBatch: 1 }));
    const job = captionJob({ mode: "full" });
    const out = await sweepCaptionJob(job, posts, artist, dated, read, later());
    expect(out).toEqual({ progress: "sweeping, 1/2", done: false });
    expect(job.state).toEqual({ mode: "full", sweepCursor: 1 });
  });

  it("fails the job when the swept credits could not be stored", async () => {
    m.sweepSilentCaptions.mockResolvedValueOnce(swept());
    m.appendSocialCredits.mockResolvedValueOnce(null);
    const out = await sweepCaptionJob(captionJob(), posts, artist, dated, read, later());
    expect(out).toEqual({ progress: "sweep storage failed", done: false });
    expect(m.failResearchJob).toHaveBeenCalledWith("job-1", "could not store swept credits");
  });

  it("counts a failed sweep batch as an attempt in ONE write, so the job can give up", async () => {
    m.sweepSilentCaptions.mockResolvedValueOnce(swept({ done: false, failed: true, nextBatch: 1 }));
    const job = captionJob({ mode: "full" });
    const out = await sweepCaptionJob(job, posts, artist, dated, read, later());
    expect(out).toEqual({ progress: "sweep batch failed, will retry", done: false });
    expect(m.failJobAtCursor).toHaveBeenCalledWith(
      "job-1",
      25,
      25,
      { mode: "full", sweepCursor: 1 },
      "a sweep batch could not be read",
    );
    // saveJobProgress resets attempts; calling it first would keep every retry at one attempt.
    expect(m.saveJobProgress).not.toHaveBeenCalled();
  });
});
