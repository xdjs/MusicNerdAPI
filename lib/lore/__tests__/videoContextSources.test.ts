import { describe, expect, it } from "vitest";
import { videoContextSources } from "@/lib/lore/videoContextSources";
import { post } from "@/lib/credits/__tests__/post";
describe("video context", () => {
  it("bounds own reel audio and excludes foreign speakers' posts and other platforms", () => {
    const own = post({ transcript: "x".repeat(6000) });
    const rows = [
      post({ isOwnPost: false, transcript: "foreign" }),
      post({ platform: "x", transcript: "wrong platform" }),
      ...Array.from({ length: 20 }, () => own),
    ];
    const context = videoContextSources(rows);
    expect(context).toHaveLength(12);
    expect(context[0]).toEqual({ url: own.url, text: "x".repeat(4000), postedAt: own.postedAt });
  });
});
