import { describe, it, expect } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { isAboutEmptyState } from "@/lib/bio/isAboutEmptyState";

describe("isAboutEmptyState", () => {
  it("is true for the claim nudge, tolerating stray whitespace", () => {
    expect(isAboutEmptyState(ABOUT_EMPTY_STATE)).toBe(true);
    expect(isAboutEmptyState(`  ${ABOUT_EMPTY_STATE}\n`)).toBe(true);
  });

  it("is false for anything else, including nothing", () => {
    expect(isAboutEmptyState("A real bio.")).toBe(false);
    expect(isAboutEmptyState(null)).toBe(false);
    expect(isAboutEmptyState(undefined)).toBe(false);
  });
});
