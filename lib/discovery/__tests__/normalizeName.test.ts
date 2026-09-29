import { describe, it, expect } from "vitest";
import { normalizeName } from "@/lib/discovery/normalizeName";

describe("normalizeName", () => {
  it("trims, lowercases and collapses whitespace, keeping word breaks", () => {
    expect(normalizeName("  Pete   RANGO ")).toBe("pete rango");
    expect(normalizeName("PeteRango")).toBe("peterango");
  });
});
