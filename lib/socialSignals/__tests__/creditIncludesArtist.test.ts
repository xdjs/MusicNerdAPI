import { describe, it, expect } from "vitest";
import { creditIncludesArtist } from "@/lib/socialSignals/creditIncludesArtist";
import { nameTokens } from "@/lib/socialSignals/nameTokens";

describe("creditIncludesArtist", () => {
  const pete = nameTokens("Pete Rango");

  it("keeps a credit naming the artist and drops one naming somebody else", () => {
    expect(creditIncludesArtist("LIL LIL, Pete Rango", pete)).toBe(true);
    expect(creditIncludesArtist("Los Caracuchos", pete)).toBe(false);
    expect(creditIncludesArtist("Brian Eno", pete)).toBe(false);
  });

  it("passes everything through when there is no name to check against", () => {
    expect(creditIncludesArtist("Anyone", new Set())).toBe(true);
  });
});
