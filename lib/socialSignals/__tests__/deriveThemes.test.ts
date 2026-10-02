import { describe, it, expect } from "vitest";
import { deriveThemes } from "@/lib/socialSignals/deriveThemes";
import { nameTokens } from "@/lib/socialSignals/nameTokens";
import { post } from "@/lib/socialSignals/__tests__/post";

const own = (i: number, caption: string, hashtags: string[] = []) =>
  post({ caption, hashtags, url: `https://www.instagram.com/p/own${i}/` });

describe("deriveThemes", () => {
  it("excludes a generic reflexive/filler word even when it recurs", () => {
    const posts = [
      own(1, "just doing this for myself alone"),
      own(2, "myself and just being honest today"),
      own(3, "only myself, just me and the music"),
      own(4, "myself again just testing"),
      own(5, "just myself, nothing else really"),
    ];
    expect(deriveThemes(posts, new Set())).toEqual([]);
  });

  it("keeps a proper-noun-style term (capitalized mid-caption) at the normal low bar", () => {
    const themes = deriveThemes(
      [own(1, "Playing in Colombia tonight"), own(2, "Back in Colombia again")],
      new Set(),
    );
    expect(themes.find(t => t.term === "colombia")).toMatchObject({
      kind: "caption_term",
      count: 2,
    });
  });

  it("keeps a repeated two-word phrase even though neither word clears the generic bar", () => {
    const themes = deriveThemes(
      [
        own(1, "house is a black church on a tuesday night"),
        own(2, "nothing like a black church energy on a good set"),
      ],
      new Set(),
    );
    expect(themes.find(t => t.term === "black church")).toMatchObject({
      kind: "caption_phrase",
      count: 2,
    });
    expect(themes.some(t => t.term === "black" && t.kind === "caption_term")).toBe(false);
    expect(themes.some(t => t.term === "church" && t.kind === "caption_term")).toBe(false);
  });

  it("reads only the artist's own posts and drops the artist's own name", () => {
    const themes = deriveThemes(
      [
        own(1, "Rango sets in Colombia", ["midjourney"]),
        own(2, "Rango back in Colombia", ["midjourney"]),
        post({ isOwnPost: false, hashtags: ["housemusic"], url: "c1" }),
        post({ isOwnPost: false, hashtags: ["housemusic"], url: "c2" }),
      ],
      nameTokens("Pete Rango"),
    );
    const terms = themes.map(t => t.term);
    expect(terms).toContain("midjourney");
    expect(terms).not.toContain("housemusic");
    expect(terms).not.toContain("rango");
  });

  it("sorts by count, then by term", () => {
    const themes = deriveThemes(
      [own(1, "", ["b", "a"]), own(2, "", ["b", "a"]), own(3, "", ["b"])],
      new Set(),
    );
    expect(themes.map(t => t.term)).toEqual(["b", "a"]);
  });
});
