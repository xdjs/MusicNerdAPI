import { describe, it, expect } from "vitest";
import { selectLatestPosts } from "@/lib/instagram/selectLatestPosts";
import type { SocialPostInsert } from "@/lib/instagram/types";

const DAY = 86_400_000;
const post = (isOwnPost: boolean, daysAgo: number | null, id = "p") =>
  ({
    isOwnPost,
    postedAt: daysAgo === null ? null : new Date(Date.now() - daysAgo * DAY),
    platformPostId: id,
  }) as unknown as SocialPostInsert;

describe("selectLatestPosts", () => {
  it("keeps the artist's own posts from the last 30 days", () => {
    const rows = [
      post(true, 1, "a"),
      post(false, 1, "b"),
      post(true, 45, "c"),
      post(true, null, "d"),
    ];
    expect(selectLatestPosts(rows).map(r => r.platformPostId)).toEqual(["a"]);
  });

  it("keeps at most nine", () => {
    const rows = Array.from({ length: 12 }, (_, i) => post(true, 1, `p${i}`));
    expect(selectLatestPosts(rows)).toHaveLength(9);
  });
});
