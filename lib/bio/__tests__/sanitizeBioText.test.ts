import { describe, it, expect } from "vitest";
import { sanitizeBioText } from "@/lib/bio/sanitizeBioText";

describe("sanitizeBioText", () => {
  // A legacy web-search-era bio as it was reported on an artist page.
  const REPORTED_BIO =
    "Pete Rango's most recent public updates include HONEY featuring Betty Dawl on Sound.xyz and the December 2, 2024 single OH-KAY! listed on Apple Music. ([sound.xyz](https://www.sound.xyz/p3t3rango/honey-ft-betty-dawl?utm_source=openai)) To become a fan, expect a genre-blending vibe—lo-fi electronic with funk and neo-soul textures—backed by collaborations like KIKI with Cherele and Breakdown with Elle Symone, plus the WILD LIFE EP. ([music.apple.com](https://music.apple.com/us/song/1758574026?utm_source=openai)) Keep up with new releases and projects at peterango.com. ([peterango.com](https://peterango.com/?utm_source=openai))";

  it("removes parenthesized markdown citations and leaves the prose around them intact", () => {
    const result = sanitizeBioText(REPORTED_BIO);
    expect(result).not.toMatch(/\]\(|https?:\/\/|utm_source|\(\s*\)| {2,}|\s+\./);
    expect(result).toContain("listed on Apple Music. To become a fan");
    expect(result).toContain("plus the WILD LIFE EP. Keep up with new releases");
    expect(result.endsWith("projects at peterango.com.")).toBe(true);
  });

  it("keeps a link's label, strips bare URLs and keeps sentence punctuation", () => {
    expect(sanitizeBioText("She released [Blue Weekend](https://example.com/blue) in 2021.")).toBe(
      "She released Blue Weekend in 2021.",
    );
    expect(sanitizeBioText("Hear it at https://example.com/track today.")).toBe(
      "Hear it at today.",
    );
    expect(sanitizeBioText("Visit https://example.com. Great artist.")).toBe(
      "Visit. Great artist.",
    );
  });

  it("leaves clean prose, real parentheses and emphasis untouched", () => {
    const clean =
      "Her debut EP (recorded across three Brooklyn basements) landed in 2019, and the **WILD LIFE** EP is her *sharpest*.";
    expect(sanitizeBioText(clean)).toBe(clean);
  });

  it("is empty for nothing, and for a citation-only bio", () => {
    expect(sanitizeBioText("")).toBe("");
    expect(sanitizeBioText(null)).toBe("");
    expect(sanitizeBioText(undefined)).toBe("");
    expect(sanitizeBioText("([sound.xyz](https://www.sound.xyz/x?utm_source=openai))")).toBe("");
  });
});
