import { expect, it } from "vitest";
import { buildCanvasOpening } from "../buildCanvasOpening";
import { canvasSeeds, DUTCH_ARTIST_ID, type CanvasEvidence } from "../const";
const source = (id: string, title: string, url: string): CanvasEvidence => ({
  id,
  title,
  url,
  text: "A documented passage.",
  category: "source",
  date: null,
  dateKind: "Unknown",
  limitation: "",
});
it("offers the same two subjects named in its invitation for Dutchyyy", () => {
  const result = buildCanvasOpening(canvasSeeds[DUTCH_ARTIST_ID]);
  expect(result.openingSuggestions).toHaveLength(2);
  for (const option of result.openingSuggestions)
    expect(result.openingQuestion).toContain(option.subject);
  expect(result.openingSuggestions[0].subject).toContain("Junk Planet");
});
it("prefers meaningful page purposes over bare domains and unrelated gallery navigation", () => {
  const result = buildCanvasOpening([
    source("gallery", "Photo gallery", "https://bioritmo.com/gallery"),
    { ...source("post", "Instagram", "https://www.instagram.com/p/test/"), mediaKind: "instagram" },
    source("discography", "Discography", "https://bioritmo.com/discography"),
  ]);
  expect(result.openingSuggestions.map(x => x.subject)).toEqual([
    "the discography",
    "this Instagram post",
  ]);
  expect(result.openingQuestion).toContain("the discography");
  expect(result.openingQuestion).toContain("this Instagram post");
});
it("does not offer a listening path without a work or turn empty extraction into a narrative", () => {
  const result = buildCanvasOpening([
    { ...source("empty", "example.com", "https://example.com"), text: "" },
  ]);
  expect(result.openingSuggestions).toEqual([]);
  expect(result.openingQuestion).not.toMatch(/listen|saved sources/i);
});
