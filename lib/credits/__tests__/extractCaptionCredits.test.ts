import { describe, it, expect, vi, beforeEach } from "vitest";
import { numberedPost } from "@/lib/credits/__tests__/post";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/generateObject", () => ({
  generateObject: (...a: unknown[]) => generateObject(...a),
}));
const { extractCaptionCredits } = await import("@/lib/credits/extractCaptionCredits");

/**
 * One credit per caption, so a batch's output is predictable.
 *
 * @param req - The generateObject request.
 * @returns A reply crediting @someone on every post in the prompt.
 */
async function replyForPrompt(req: unknown) {
  const urls = [
    ...new Set(
      [
        ...String((req as { prompt: string }).prompt).matchAll(
          /https:\/\/www\.instagram\.com\/p\/POST\d+\//g,
        ),
      ].map(m => m[0]),
    ),
  ];
  return {
    output: {
      credits: urls.map(url => ({
        subject: "someone",
        isHandle: true,
        role: "Mixed by",
        quote: "Mixed by @someone on this one.",
        url,
      })),
      statements: [],
    },
  };
}

/**
 * Makes every Date.now() read a millisecond later, so a budget can bite with an instant model.
 *
 * @returns The spy, to restore.
 */
function clockThatAdvancesEachRead() {
  const start = Date.now();
  let elapsed = 0;
  return vi.spyOn(Date, "now").mockImplementation(() => start + elapsed++);
}

const posts = Array.from({ length: 40 }, (_, i) => numberedPost(i));

beforeEach(() => {
  generateObject.mockReset().mockImplementation(replyForPrompt);
  vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("extractCaptionCredits, sliced", () => {
  it("is done immediately when there is nothing to read", async () => {
    const slice = await extractCaptionCredits([], "Artist", "artist");
    expect(slice).toMatchObject({ done: true, nextBatch: 0, totalBatches: 0 });
    expect(slice.extraction.credits).toHaveLength(0);
  });

  it("declines to start anything when there is no usable time left", async () => {
    const slice = await extractCaptionCredits(posts, "Artist", "artist", { budgetMs: 1 });
    expect(slice.done).toBe(false);
    expect(slice.nextBatch).toBe(0);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("reports where to resume when it runs out partway, and resumes without repeating", async () => {
    const clock = clockThatAdvancesEachRead();
    const first = await extractCaptionCredits(posts, "Artist", "artist", {
      budgetMs: 9_000,
    }).finally(() => clock.mockRestore());
    expect(first.done).toBe(false);
    expect(first.nextBatch).toBeGreaterThan(0);
    expect(first.nextBatch).toBeLessThan(first.totalBatches);
    const firstUrls = new Set(first.extraction.credits.map(c => c.url));

    const second = await extractCaptionCredits(posts, "Artist", "artist", {
      startBatch: first.nextBatch,
    });
    expect(second.done).toBe(true);
    expect(second.nextBatch).toBe(second.totalBatches);
    const secondUrls = new Set(second.extraction.credits.map(c => c.url));
    for (const u of secondUrls) expect(firstUrls.has(u)).toBe(false);
    expect(firstUrls.size + secondUrls.size).toBe(posts.length);
  });

  it("does not start a batch it cannot finish", async () => {
    generateObject.mockImplementation(async (req: unknown) => {
      await new Promise(r => setTimeout(r, 120));
      return replyForPrompt(req);
    });
    const constrained = await extractCaptionCredits(posts, "Artist", "artist", {
      budgetMs: 11_000,
    });
    const constrainedCalls = generateObject.mock.calls.length;
    generateObject.mockClear();
    const unlimited = await extractCaptionCredits(posts, "Artist", "artist");
    expect(constrainedCalls).toBeLessThan(generateObject.mock.calls.length);
    expect(constrained.done).toBe(false);
    expect(unlimited.done).toBe(true);
  });

  it("stops at the first batch it could not read and does not advance past it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    generateObject.mockImplementationOnce(replyForPrompt).mockImplementationOnce(async () => {
      throw new Error("429");
    });
    const slice = await extractCaptionCredits(posts, "Artist", "artist");
    expect(slice).toMatchObject({ failed: true, done: false, nextBatch: 1, totalBatches: 5 });
    expect(slice.extraction.credits).toHaveLength(8);
  });

  it("drops exact repeats across batches", async () => {
    const twice = [numberedPost(1), numberedPost(1)];
    const slice = await extractCaptionCredits(twice, "Artist", "artist");
    expect(slice.extraction.credits).toHaveLength(1);
  });
});
