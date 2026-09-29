import { describe, it, expect } from "vitest";
import { scanStandouts } from "@/lib/socialSignals/scanStandouts";
import type { StandoutPost } from "@/lib/socialSignals/types";
import { post } from "@/lib/socialSignals/__tests__/post";

const posts = [410, 58, 50, 60, 55, 70].map((likeCount, i) =>
  post({ likeCount, url: `u${i}`, caption: i === 0 ? "the big one" : "x" }),
);

describe("scanStandouts", () => {
  it("records posts at three times the median or more, with their multiple", () => {
    const byUrl = new Map<string, StandoutPost>();
    scanStandouts(posts, "likes", p => p.likeCount, byUrl);
    expect([...byUrl.values()]).toEqual([
      { url: "u0", metric: "likes", value: 410, median: 59, multiple: 6.9, caption: "the big one" },
    ]);
  });

  it("needs five positive samples before judging anything", () => {
    const byUrl = new Map<string, StandoutPost>();
    scanStandouts(posts.slice(0, 4), "likes", p => p.likeCount, byUrl);
    expect(byUrl.size).toBe(0);
  });

  it("keeps the higher multiple when a post already stands out on another metric", () => {
    const byUrl = new Map<string, StandoutPost>([
      ["u0", { url: "u0", metric: "plays", value: 1, median: 1, multiple: 99, caption: null }],
    ]);
    scanStandouts(posts, "likes", p => p.likeCount, byUrl);
    expect(byUrl.get("u0")?.metric).toBe("plays");
  });
});
