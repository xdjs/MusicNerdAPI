import { describe, it, expect } from "vitest";
import { relevancePage } from "@/lib/relevance/relevancePage";

const anchor = { name: "Black Dave", identifiers: [] };

describe("relevancePage", () => {
  it("numbers the page and gives its title, tier, mentions and excerpt", () => {
    const text = ["Black Dave released it.", "Second.", "Third.", "Fourth."].join("\n\n");
    expect(
      relevancePage({ url: "https://www.discogs.com/artist/1", title: "Discogs", text }, 2, anchor),
    ).toBe(
      `--- PAGE 2 ---\nTITLE: Discogs\nTIER: preferred\nMENTIONS: names the artist in 1 of 4 paragraphs\n${text}`,
    );
  });

  it("says unknown mentions for unstructured text, (none) for no title, and cuts the excerpt at 1,500", () => {
    const out = relevancePage(
      { url: "https://a.example/x", title: null, text: "x".repeat(2000) },
      0,
      anchor,
    );
    expect(out).toContain("TITLE: (none)");
    expect(out).toContain("TIER: unknown");
    expect(out).toContain("MENTIONS: unknown (no paragraph structure)");
    expect(out.endsWith("x".repeat(1500))).toBe(true);
    expect(out).not.toContain("x".repeat(1501));
  });

  it("calls the artist's own site preferred when the caller says so", () => {
    const own = relevancePage(
      { url: "https://blackdave.example", title: "t", text: "t", ownDomain: true },
      0,
      anchor,
    );
    expect(own).toContain("TIER: preferred");
  });
});
