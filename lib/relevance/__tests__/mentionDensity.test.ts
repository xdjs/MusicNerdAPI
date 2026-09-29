import { describe, it, expect } from "vitest";
import { mentionDensity } from "@/lib/relevance/mentionDensity";

const paras = (n: number, hit: (i: number) => string | null) =>
  Array.from({ length: n }, (_, i) => hit(i) ?? `Some other producer ${i}.`).join("\n\n");

describe("mentionDensity", () => {
  it("counts paragraphs naming the artist, with flexible whitespace", () => {
    const text = paras(20, i =>
      i === 3 ? "Pete  Rango is listed here." : i === 7 ? "Pete\nRango again" : null,
    );
    expect(mentionDensity(text, "Pete Rango")).toEqual({ hits: 2, total: 20 });
  });

  it("counts the longest distinctive token and confirmed handles", () => {
    const text = paras(6, i => (i === 0 ? "RANGO wordmark" : i === 1 ? "follow @p3t3rango" : null));
    expect(mentionDensity(text, "Pete Rango")).toEqual({ hits: 1, total: 6 });
    expect(mentionDensity(text, "Pete Rango", ["instagram: p3t3rango", "site: https"])).toEqual({
      hits: 2,
      total: 6,
    });
  });

  it("is null without paragraph structure or a name", () => {
    expect(mentionDensity("one flattened line about Pete Rango", "Pete Rango")).toBeNull();
    expect(
      mentionDensity(
        paras(5, () => null),
        "  ",
      ),
    ).toBeNull();
  });
});
