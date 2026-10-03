import { describe, it, expect } from "vitest";
import { themeCandidates } from "@/lib/questions/themeCandidates";

describe("themeCandidates", () => {
  it("offers the single strongest theme, a hashtag winning a tie with the same word", () => {
    const out = themeCandidates("Pete Rango", [
      { term: "midjourney", kind: "caption_term", count: 3, evidenceUrls: ["w"] },
      { term: "midjourney", kind: "hashtag", count: 3, evidenceUrls: ["h"] },
      { term: "colombia", kind: "caption_term", count: 2, evidenceUrls: ["c"] },
    ]);
    expect(out).toEqual([
      {
        signalId: "theme_hashtag_midjourney",
        kind: "theme",
        key: "social_theme_hashtag_midjourney",
        authoredBy: "artist",
        material:
          'Pete Rango recurringly uses the hashtag "midjourney" in their own social captions (appears in 3 of their own posts).',
        sourceUrls: ["h"],
      },
    ]);
  });

  it("names a phrase as a phrase", () => {
    const [c] = themeCandidates("X", [
      { term: "black church", kind: "caption_phrase", count: 2, evidenceUrls: ["u"] },
    ]);
    expect(c.key).toBe("social_theme_caption_phrase_black_church");
    expect(c.material).toContain('the phrase "black church"');
  });
});
