import { describe, it, expect, vi, beforeEach } from "vitest";
import { numberedPost } from "@/lib/credits/__tests__/post";

const extractCaptionCredits = vi.hoisted(() => vi.fn());
vi.mock("@/lib/credits/extractCaptionCredits", () => ({
  extractCaptionCredits: (...a: unknown[]) => extractCaptionCredits(...a),
}));
const { sweepSilentCaptions } = await import("@/lib/credits/sweepSilentCaptions");

const posts = Array.from({ length: 16 }, (_, i) => numberedPost(i));

beforeEach(() => {
  extractCaptionCredits.mockReset();
  vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("sweepSilentCaptions", () => {
  it("re-reads only the captions that produced nothing, returning the slice", async () => {
    const slice = {
      extraction: { credits: [], statements: [] },
      nextBatch: 1,
      totalBatches: 1,
      done: true,
    };
    extractCaptionCredits.mockResolvedValueOnce(slice);
    const claimed = new Set(posts.slice(0, 12).map(p => p.url));
    const opts = { budgetMs: 30_000, startBatch: 0 };
    expect(await sweepSilentCaptions(posts, claimed, "Artist", "artist", opts)).toBe(slice);
    expect(extractCaptionCredits).toHaveBeenCalledWith(posts.slice(12), "Artist", "artist", opts);
  });

  it("is done without a model call when every caption is claimed", async () => {
    const claimed = new Set(posts.map(p => p.url));
    expect(await sweepSilentCaptions(posts, claimed, "Artist", "artist")).toMatchObject({
      done: true,
      nextBatch: 0,
      totalBatches: 0,
    });
    expect(extractCaptionCredits).not.toHaveBeenCalled();
  });
});
