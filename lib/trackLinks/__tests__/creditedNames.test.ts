import { describe, expect, it } from "vitest";
import { creditedNames } from "@/lib/trackLinks/creditedNames";
import { versionCredits } from "@/lib/trackLinks/versionCredits";

describe("creditedNames", () => {
  it("splits a credit on every separator, normalised", () => {
    expect(creditedNames("Dame Atlas & Pete Rango")).toEqual(["dame atlas", "pete rango"]);
    expect(creditedNames("A feat. B, C x D vs E with F and G / H")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
  });

  it("keeps one person as one name", () => {
    expect(creditedNames("Dave East")).toEqual(["dave east"]);
  });
});

describe("versionCredits", () => {
  it("returns only bracketed segments that name a version", () => {
    expect(versionCredits("crying on the floor (pete rango mix)")).toEqual(["pete rango mix"]);
    expect(versionCredits("Song [Live] (feat. Someone)")).toEqual(["live"]);
    expect(versionCredits("Rango Sessions")).toEqual([]);
  });
});
