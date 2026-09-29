import { describe, it, expect } from "vitest";
import { containsQuote } from "@/lib/credits/containsQuote";

describe("containsQuote", () => {
  it("tolerates reflowed whitespace and case", () => {
    expect(
      containsQuote("Mixing & Mastering\nEngineer: @x", "mixing  &  mastering engineer:"),
    ).toBe(true);
  });

  it("rejects altered words and an empty quote", () => {
    expect(containsQuote("Mixing & Mastering", "Mixing and Mastering")).toBe(false);
    expect(containsQuote("anything", "   ")).toBe(false);
  });
});
