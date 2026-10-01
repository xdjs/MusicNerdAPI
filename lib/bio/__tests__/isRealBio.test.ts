import { describe, it, expect } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { isRealBio } from "@/lib/bio/isRealBio";

describe("isRealBio", () => {
  it("is true for a non-empty bio that isn't the claim nudge", () => {
    expect(isRealBio("A real bio.")).toBe(true);
  });

  it("is false for empty, whitespace, missing or the claim nudge", () => {
    expect(isRealBio("")).toBe(false);
    expect(isRealBio("   ")).toBe(false);
    expect(isRealBio(null)).toBe(false);
    expect(isRealBio(undefined)).toBe(false);
    expect(isRealBio(` ${ABOUT_EMPTY_STATE} `)).toBe(false);
  });
});
