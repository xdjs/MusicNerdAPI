import { describe, it, expect } from "vitest";
import { selectSourceText } from "@/lib/lore/selectSourceText";
import { SOURCE_TEXT_BUDGET } from "@/lib/lore/const";

describe("selectSourceText", () => {
  it("keeps paragraphs that name the artist over ones that merely came first", () => {
    const filler = "Richmond has a long history of independent venues and community radio. ".repeat(
      200,
    );
    const credit = "\n\nPete Rango landed a placement for his song on HBO's Insecure.\n\n";
    const text = filler + credit + filler;
    expect(text.indexOf("HBO")).toBeGreaterThan(SOURCE_TEXT_BUDGET);
    expect(selectSourceText(text, "Pete Rango")).toContain("HBO");
  });

  it("returns short text untouched", () => {
    const short = "Pete Rango is a producer from Bogota.";
    expect(selectSourceText(short, "Pete Rango")).toBe(short);
  });

  it("falls back to a head slice when the text has no paragraph structure", () => {
    expect(selectSourceText("x".repeat(SOURCE_TEXT_BUDGET + 3000), "Pete Rango")).toHaveLength(
      SOURCE_TEXT_BUDGET,
    );
  });

  it("keeps the order of the paragraphs it keeps", () => {
    const para = (s: string) => s + " filler".repeat(700);
    const text = [para("A about Pete Rango"), para("B other"), para("C about Rango")].join("\n\n");
    const out = selectSourceText(text, "Pete Rango");
    expect(out.indexOf("A about")).toBeLessThan(out.indexOf("C about"));
    expect(out).not.toContain("B other");
  });
});
