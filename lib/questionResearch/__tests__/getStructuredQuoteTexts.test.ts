import { expect, it } from "vitest";
import { getStructuredQuoteTexts } from "@/lib/questionResearch/getStructuredQuoteTexts";
it("decodes the complete provider text fields without stitching them", () => {
  expect(
    getStructuredQuoteTexts(
      JSON.stringify({
        title: "A title",
        description: "A\ndescription",
        collection_name: "C",
        other: "x",
      }),
    ),
  ).toEqual(["A title", "A\ndescription", "C"]);
});
it("returns nothing for malformed, non-object or non-string records", () => {
  expect(getStructuredQuoteTexts('{"title":')).toEqual([]);
  expect(getStructuredQuoteTexts("[1]")).toEqual([]);
  expect(getStructuredQuoteTexts(JSON.stringify({ title: 1 }))).toEqual([]);
});
