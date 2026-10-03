import { describe, it, expect } from "vitest";
import { standoutCandidates } from "@/lib/questions/standoutCandidates";

const s = (url: string, multiple: number, caption: string | null = "the big one") => ({
  url,
  metric: "plays" as const,
  value: 1,
  median: 1,
  multiple,
  caption,
});

describe("standoutCandidates", () => {
  it("offers the top three by multiple, keyed by shortcode", () => {
    const out = standoutCandidates("Pete", [
      s("https://www.instagram.com/p/A/", 3),
      s("https://www.instagram.com/p/B/", 7.6, null),
      s("https://www.instagram.com/p/C/", 4),
      s("https://www.instagram.com/p/D/", 5),
    ]);
    expect(out.map(c => c.key)).toEqual([
      "social_standout_B",
      "social_standout_D",
      "social_standout_C",
    ]);
    expect(out[0].material).toBe(
      "One of Pete's own posts noticeably outperformed their typical plays on the same platform (roughly 7.6x their usual). Its caption: (no caption)",
    );
  });
});
