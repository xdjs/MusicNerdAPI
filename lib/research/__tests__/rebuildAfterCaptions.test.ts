import { describe, it, expect, vi, beforeEach } from "vitest";
import { captionJob } from "@/lib/research/__tests__/captionJob";

const m = vi.hoisted(() => ({
  refreshArtistDoc: vi.fn(),
  saveJobProgress: vi.fn(),
  failResearchJob: vi.fn(),
  completeResearchJob: vi.fn(),
  queueLoreRefreshAfterCaptions: vi.fn(),
}));
vi.mock("@/lib/lore/refreshArtistDoc", () => ({
  refreshArtistDoc: (...a: unknown[]) => m.refreshArtistDoc(...a),
}));
vi.mock("@/lib/research/saveJobProgress", () => ({
  saveJobProgress: (...a: unknown[]) => m.saveJobProgress(...a),
}));
vi.mock("@/lib/research/failResearchJob", () => ({
  failResearchJob: (...a: unknown[]) => m.failResearchJob(...a),
}));
vi.mock("@/lib/research/completeResearchJob", () => ({
  completeResearchJob: (...a: unknown[]) => m.completeResearchJob(...a),
}));
vi.mock("@/lib/research/queueLoreRefreshAfterCaptions", () => ({
  queueLoreRefreshAfterCaptions: (...a: unknown[]) => m.queueLoreRefreshAfterCaptions(...a),
}));
const { rebuildAfterCaptions } = await import("@/lib/research/rebuildAfterCaptions");

const read = {
  extraction: { credits: [], statements: [] },
  nextBatch: 3,
  totalBatches: 3,
  done: true,
};
const later = () => Date.now() + 50_000;

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
});

describe("rebuildAfterCaptions", () => {
  it("defers the rebuild to its own slice when under 20 s are left", async () => {
    const job = captionJob({ mode: "full", swept: true });
    const out = await rebuildAfterCaptions(job, read, Date.now() + 15_000);
    expect(out).toEqual({ progress: "credits stored, document rebuild deferred", done: false });
    expect(m.saveJobProgress).toHaveBeenCalledWith("job-1", 3, { total: 3, state: job.state });
    expect(m.refreshArtistDoc).not.toHaveBeenCalled();
  });

  it("completes when the document was rebuilt", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("rebuilt");
    expect(await rebuildAfterCaptions(captionJob(), read, later())).toEqual({
      progress: "complete, 3 batch(es)",
      done: true,
    });
    expect(m.refreshArtistDoc).toHaveBeenCalledWith("artist-1");
    expect(m.completeResearchJob).toHaveBeenCalledWith("job-1");
  });

  it("queues first-time Lore after captions supply material instead of silently skipping it", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("no-document");
    m.queueLoreRefreshAfterCaptions.mockResolvedValueOnce(true);
    const out = await rebuildAfterCaptions(captionJob(), read, later());
    expect(out).toEqual({ progress: "complete, 3 batch(es), Lore refresh queued", done: true });
    expect(m.queueLoreRefreshAfterCaptions).toHaveBeenCalledWith(captionJob());
    expect(m.failResearchJob).not.toHaveBeenCalled();
  });

  it("does not queue a second Lore refresh when a retried caption tail already handed it off", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("no-document");
    m.queueLoreRefreshAfterCaptions.mockResolvedValueOnce(false);
    expect(await rebuildAfterCaptions(captionJob(), read, later())).toEqual({
      progress: "complete, 3 batch(es), Lore refresh already queued",
      done: true,
    });
  });

  it("states when extracted captions still contain no citable Lore material", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("no-material");
    expect(await rebuildAfterCaptions(captionJob(), read, later())).toEqual({
      progress: "complete, 3 batch(es), no readable Lore material",
      done: true,
    });
    expect(m.queueLoreRefreshAfterCaptions).not.toHaveBeenCalled();
  });

  it("still fails, and retries, when the rebuild genuinely breaks", async () => {
    m.refreshArtistDoc.mockResolvedValueOnce("failed");
    const out = await rebuildAfterCaptions(captionJob(), read, later());
    expect(out).toEqual({
      progress: "credits stored, document rebuild failed — will retry",
      done: false,
    });
    expect(m.failResearchJob).toHaveBeenCalledWith(
      "job-1",
      "credits stored but the document rebuild failed",
    );
    expect(m.completeResearchJob).not.toHaveBeenCalled();
  });
});
