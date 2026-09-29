import { describe, it, expect } from "vitest";
import { selectRecentPosts } from "@/lib/socialSignals/selectRecentPosts";
import { post } from "@/lib/socialSignals/__tests__/post";

const NOW = Date.parse("2026-08-21T00:00:00Z");
const at = (postedAt: string, id: string) =>
  post({ postedAt, platformPostId: id, url: `https://instagram.com/p/${id}` });

describe("selectRecentPosts", () => {
  it("drops posts outside the window when there is plenty of recent activity", () => {
    const recent = Array.from({ length: 40 }, (_, i) =>
      at(`2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, `r${i}`),
    );
    const ancient = Array.from({ length: 40 }, (_, i) => at("2020-03-01T00:00:00Z", `a${i}`));
    const picked = selectRecentPosts([...ancient, ...recent], NOW);
    expect(picked).toHaveLength(40);
    expect(picked.every(p => p.postedAt.startsWith("2026"))).toBe(true);
  });

  it("falls back to the full history, newest first, when recent activity is thin", () => {
    const old = Array.from({ length: 5 }, (_, i) => at(`201${i + 4}-01-01T00:00:00Z`, `o${i}`));
    const picked = selectRecentPosts(old, NOW);
    expect(picked).toHaveLength(5);
    expect(picked[0].postedAt.startsWith("2018")).toBe(true);
  });

  it("sorts undated posts last without discarding them", () => {
    const picked = selectRecentPosts([at("", "u"), at("2026-01-01T00:00:00Z", "d")], NOW);
    expect(picked.map(p => p.platformPostId)).toEqual(["d", "u"]);
  });
});
