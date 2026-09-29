import { describe, it, expect } from "vitest";
import { normalizeLoose } from "@/lib/instagram/normalizeLoose";

describe("normalizeLoose", () => {
  it("collapses a display name and its handle to the same key", () => {
    expect(normalizeLoose("Pharaoh Sistare")).toBe(normalizeLoose("@pharaohsistare"));
  });

  it("strips everything that is not a letter or digit", () => {
    expect(normalizeLoose(" P3T3.RANGO ")).toBe("p3t3rango");
  });
});
