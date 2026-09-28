import { describe, it, expect } from "vitest";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";

describe("normalizeHandle", () => {
  it("trims, lowercases and drops a leading @", () => {
    expect(normalizeHandle("  @P3t3Rango ")).toBe("p3t3rango");
  });

  it("keeps inner punctuation, unlike the loose form", () => {
    expect(normalizeHandle("dear_rod.1")).toBe("dear_rod.1");
  });
});
