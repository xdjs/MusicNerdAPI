import { describe, expect, it } from "vitest";
import { getMatchScore } from "@/lib/artistSearch/getMatchScore";
import { getLinkCount } from "@/lib/artistSearch/getLinkCount";

describe("getMatchScore", () => {
  it("ranks exact, prefix, substring, then everything else, case-insensitively", () => {
    expect(getMatchScore("Pete Rango", "pete rango")).toBe(0);
    expect(getMatchScore("Pete Rango", "pete")).toBe(1);
    expect(getMatchScore("Pete Rango", "rango")).toBe(2);
    expect(getMatchScore("Pete Rango", "dame")).toBe(3);
  });

  it("does not normalise accents or punctuation, as the single search did not", () => {
    expect(getMatchScore("Sigur Rós", "sigur ros")).toBe(3);
  });
});

describe("getLinkCount", () => {
  it("counts the set link fields, ignoring null, undefined and empty", () => {
    expect(
      getLinkCount({
        bandcamp: "b",
        x: "",
        instagram: null,
        tiktok: undefined,
        youtube: "y",
        name: "n",
      }),
    ).toBe(2);
    expect(getLinkCount({})).toBe(0);
  });
});
