import { expect, it } from "vitest";
import { diversifyResearchOriginals } from "../diversifyResearchOriginals";
import type { ResearchOriginal } from "../types";
const source = (sourceId: string, url: string) => ({ sourceId, url }) as ResearchOriginal;
it("keeps the existing provider browse order and leaves the input unchanged", () => {
  const sources = [
    source("ig-new", "https://instagram.com/p/new/"),
    source("ig-old", "https://www.instagram.com/p/old/"),
    source("x", "https://x.com/artist/status/1"),
    source("article", "https://magazine.test/story"),
    source("second-article", "https://magazine.test/other"),
  ];
  const input = [...sources];
  expect(diversifyResearchOriginals(sources).map(s => s.sourceId)).toEqual([
    "ig-new",
    "x",
    "article",
    "ig-old",
    "second-article",
  ]);
  expect(sources).toEqual(input);
});
it("handles no sources without inventing candidates", () => {
  expect(diversifyResearchOriginals([])).toEqual([]);
});
