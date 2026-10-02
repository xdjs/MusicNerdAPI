import { describe, it, expect } from "vitest";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";

describe("stripCitationMarkers", () => {
  it("removes every marker regardless of validity, leaving plain prose", () => {
    expect(stripCitationMarkers("Cited Lauryn Hill as an influence[3] and Solange[3].")).toBe(
      "Cited Lauryn Hill as an influence and Solange.",
    );
    expect(stripCitationMarkers("No markers here.")).toBe("No markers here.");
  });

  it("strips grouped markers, which a sentence resting on two sources gets", () => {
    expect(stripCitationMarkers("and education [3, 4]. Rango composes soundscapes [2, 3].")).toBe(
      "and education. Rango composes soundscapes.",
    );
    expect(stripCitationMarkers("spaced [1 , 2] and tight[4,5,6] both go")).toBe(
      "spaced and tight both go",
    );
  });

  it("leaves square brackets that are prose alone", () => {
    expect(stripCitationMarkers("the label [now defunct] released it")).toBe(
      "the label [now defunct] released it",
    );
  });

  it("does not leave a space before punctuation when the model spaced its marker", () => {
    expect(stripCitationMarkers("Pete Rango is a producer based in Miami, FL [1].")).toBe(
      "Pete Rango is a producer based in Miami, FL.",
    );
    expect(stripCitationMarkers("He founded XUE RECORDS[2]. His work aired on HBO[3].")).toBe(
      "He founded XUE RECORDS. His work aired on HBO.",
    );
    expect(stripCitationMarkers("a hardcore band [4], then electronic music [5].")).toBe(
      "a hardcore band, then electronic music.",
    );
  });

  it("never pulls a paragraph break out with a marker at the start of a line", () => {
    expect(stripCitationMarkers("First line.\n[1] Second line.")).toBe("First line.\nSecond line.");
  });
});
