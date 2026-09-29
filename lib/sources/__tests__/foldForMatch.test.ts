import { describe, it, expect } from "vitest";
import { foldForMatch } from "@/lib/sources/foldForMatch";

describe("foldForMatch", () => {
  it("lowercases, strips diacritics and turns every non-alphanumeric run into one space", () => {
    expect(foldForMatch("  PETE Rango!! ")).toBe("pete rango");
    expect(foldForMatch("Sigur Rós — live")).toBe("sigur ros live");
    expect(foldForMatch("pete-rango")).toBe("pete rango");
  });
});
