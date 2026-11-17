import { describe, expect, it } from "vitest";
import { findCitationNumbers } from "@/lib/chat/findCitationNumbers";

describe("findCitationNumbers", () => {
  it("reads [n] and grouped markers in order, every occurrence", () => {
    expect(findCitationNumbers("A [1]. B [3, 8]. A again [1].")).toEqual([
      { n: 1, locator: null },
      { n: 3, locator: null },
      { n: 8, locator: null },
      { n: 1, locator: null },
    ]);
  });

  it("keeps the numbers of a mixed group", () => {
    expect(findCitationNumbers("[19, 21, Artist Doc]").map(c => c.n)).toEqual([19, 21]);
  });

  it("reads a document-form citation as its first element with its locator", () => {
    expect(findCitationNumbers("[1, p.2] [2, §Early years] [3, ¶4] [4, p. 5]")).toEqual([
      { n: 1, locator: "p.2" },
      { n: 2, locator: "§Early years" },
      { n: 3, locator: "¶4" },
      { n: 4, locator: "p. 5" },
    ]);
  });

  it("takes only the first element of a bracket with a locator", () => {
    expect(findCitationNumbers("[1, §Live, 1999]")).toEqual([{ n: 1, locator: "§Live, 1999" }]);
    expect(findCitationNumbers("[1, §2007-08 tour]")).toEqual([{ n: 1, locator: "§2007-08 tour" }]);
  });

  it("reads no dates or years as citations, bracketed or in prose", () => {
    expect(findCitationNumbers("Released [2026-05-13] in 1999, toured 2007-08 [1999].")).toEqual(
      [],
    );
  });

  it("ignores zero, words and empty text", () => {
    expect(findCitationNumbers("[0] [n] [see above] no markers")).toEqual([]);
    expect(findCitationNumbers("")).toEqual([]);
  });
});
