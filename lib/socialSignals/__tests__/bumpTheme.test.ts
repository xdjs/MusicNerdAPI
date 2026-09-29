import { describe, it, expect } from "vitest";
import { bumpTheme } from "@/lib/socialSignals/bumpTheme";
import type { ThemeTally } from "@/lib/socialSignals/types";

describe("bumpTheme", () => {
  it("counts a term per kind and keeps its evidence, capped and deduped", () => {
    const tally: ThemeTally = new Map();
    bumpTheme(tally, "colombia", "caption_term", "u1");
    bumpTheme(tally, "colombia", "caption_term", "u1");
    bumpTheme(tally, "colombia", "hashtag", "u2");
    expect(tally.get("caption_term:colombia")).toEqual({
      kind: "caption_term",
      count: 2,
      evidenceUrls: ["u1"],
    });
    expect(tally.get("hashtag:colombia")?.count).toBe(1);
  });
});
