import { describe, it, expect, vi, beforeEach } from "vitest";
import { numberedPost } from "@/lib/credits/__tests__/post";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/generateObject", () => ({
  generateObject: (...a: unknown[]) => generateObject(...a),
}));
const { runCaptionBatch } = await import("@/lib/credits/runCaptionBatch");

const reply = (urls: string[]) => ({
  credits: urls.map(url => ({
    subject: "someone",
    isHandle: true,
    role: "Mixed by",
    quote: "Mixed by @someone on this one.",
    url,
  })),
  statements: [],
});
const urlsIn = (req: unknown) =>
  [
    ...String((req as { prompt: string }).prompt).matchAll(
      /https:\/\/www\.instagram\.com\/p\/POST\d+\//g,
    ),
  ].map(m => m[0]);

beforeEach(() => {
  generateObject.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("runCaptionBatch", () => {
  it("sends the captions with the artist's instruction at temperature 0 and verifies the reply", async () => {
    const posts = [numberedPost(1), numberedPost(2)];
    generateObject.mockImplementationOnce(async (req: unknown) => ({ output: reply(urlsIn(req)) }));
    const out = await runCaptionBatch(posts, "Artist", "artist", "0", 1000);
    expect(out?.credits.map(c => c.url)).toEqual(posts.map(p => p.url));
    const req = generateObject.mock.calls[0][0];
    expect(req.temperature).toBe(0);
    expect(req.instructions).toContain("the musician Artist (@artist)");
    expect(req.prompt.startsWith("CAPTIONS:\n")).toBe(true);
    expect(JSON.parse(req.prompt.slice("CAPTIONS:\n".length))).toEqual(
      posts.map(p => ({ url: p.url, postedAt: p.postedAt, caption: p.caption })),
    );
  });

  it("keeps the valid claims when the schema rejects one malformed sibling", async () => {
    const posts = [numberedPost(1), numberedPost(2)];
    generateObject.mockImplementationOnce(async () => {
      throw Object.assign(new Error("No object generated"), {
        name: "AI_NoObjectGeneratedError",
        text: JSON.stringify({
          credits: [
            {
              subject: "someone",
              isHandle: true,
              role: "Mixed by",
              quote: "Mixed by @someone on this one.",
              url: posts[0].url,
            },
            {
              subject: 123,
              isHandle: "yes",
              role: null,
              quote: "Mixed by @someone on this one.",
              url: posts[1].url,
            },
          ],
          statements: [],
        }),
      });
    });
    const out = await runCaptionBatch(posts, "Artist", "artist", "0", 1000);
    expect(out?.credits.map(c => c.url)).toEqual([posts[0].url]);
  });

  it("retries a timed-out batch as two halves, each with what is left", async () => {
    const posts = [1, 2, 3, 4].map(numberedPost);
    generateObject
      .mockImplementationOnce(async () => {
        throw new Error("caption extraction timed out");
      })
      .mockImplementation(async (req: unknown) => ({ output: reply(urlsIn(req)) }));
    const out = await runCaptionBatch(posts, "Artist", "artist", "0", 20_000);
    expect(generateObject).toHaveBeenCalledTimes(3);
    expect(out?.credits.map(c => c.url)).toEqual(posts.map(p => p.url));
  });

  it("is null, not empty, when the batch could not be read", async () => {
    generateObject.mockImplementationOnce(async () => {
      throw new Error("429");
    });
    expect(await runCaptionBatch([numberedPost(1)], "Artist", "artist", "0", 1000)).toBeNull();
  });

  it("is null when both halves of a timed-out batch fail", async () => {
    generateObject.mockImplementation(async () => {
      throw new Error("caption extraction timed out");
    });
    expect(
      await runCaptionBatch([1, 2, 3].map(numberedPost), "Artist", "artist", "0", 20_000),
    ).toBeNull();
  });

  // LATASHÁ, production 2026-10-01: the first call spent its whole budget and
  // the halves got the same budget again, so the invocation was killed at 60 s
  // before the slice could write anything, every lease, for two days.
  it("does not retry when the timed-out call spent the whole budget", async () => {
    vi.useFakeTimers();
    generateObject.mockImplementation(() => new Promise(() => {}));
    const pending = runCaptionBatch(
      [1, 2, 3, 4].map(numberedPost),
      "Artist",
      "artist",
      "0",
      20_000,
    );
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toBeNull();
    expect(generateObject).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("gives the halves what is left of the budget, not a fresh one", async () => {
    vi.useFakeTimers();
    generateObject
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("caption extraction timed out")), 5_000),
          ),
      )
      .mockImplementation(() => new Promise(() => {}));
    let settled = false;
    const pending = runCaptionBatch(
      [1, 2, 3, 4].map(numberedPost),
      "Artist",
      "artist",
      "0",
      20_000,
    ).finally(() => (settled = true));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(generateObject).toHaveBeenCalledTimes(3);
    expect(settled).toBe(true);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });

  it("times a batch out at its budget", async () => {
    vi.useFakeTimers();
    generateObject.mockImplementationOnce(() => new Promise(() => {}));
    const pending = runCaptionBatch([numberedPost(1)], "Artist", "artist", "0", 500);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });
});
