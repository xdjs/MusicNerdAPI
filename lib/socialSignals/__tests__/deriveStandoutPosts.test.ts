import { describe, it, expect } from "vitest";
import { deriveStandoutPosts } from "@/lib/socialSignals/deriveStandoutPosts";
import { post } from "@/lib/socialSignals/__tests__/post";

describe("deriveStandoutPosts", () => {
  it("compares engagement only within the same platform", () => {
    const posts = [
      ...Array.from({ length: 7 }, (_, i) =>
        post({ platform: "instagram", likeCount: 10, playCount: null, url: `ig${i}` }),
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        post({ platform: "x", likeCount: 10000, playCount: null, url: `x${i}` }),
      ),
      post({ platform: "instagram", likeCount: 100, playCount: null, url: "ig-hit" }),
    ];
    expect(deriveStandoutPosts(posts).map(p => p.url)).toEqual(["ig-hit"]);
  });
  it("flags own posts against likes and plays, strongest multiple first", () => {
    const posts = [
      ...[10, 11, 12, 13, 14].map((n, i) =>
        post({ likeCount: n, playCount: 100 + i, url: `r${i}` }),
      ),
      post({ likeCount: 12, playCount: 900, url: "plays" }),
      post({ likeCount: 100, playCount: 101, url: "likes" }),
      post({ isOwnPost: false, likeCount: 5000, url: "collab" }),
    ];
    const out = deriveStandoutPosts(posts);
    expect(out.map(s => [s.url, s.metric])).toEqual([
      ["plays", "plays"],
      ["likes", "likes"],
    ]);
  });

  it("finds nothing on thin data", () => {
    const posts = [1000, 5, 5].map((likeCount, i) => post({ likeCount, url: `t${i}` }));
    expect(deriveStandoutPosts(posts)).toEqual([]);
  });
});
