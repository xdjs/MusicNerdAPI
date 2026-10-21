import { describe, expect, it } from "vitest";
import { getNormalisedMatchScore } from "@/lib/artistSearch/getNormalisedMatchScore";

describe("getNormalisedMatchScore", () => {
  it("scores 0 exact, 1 prefix, 2 substring, 3 otherwise, ignoring accents and punctuation", () => {
    expect(getNormalisedMatchScore("Beyoncé", "beyonce")).toBe(0);
    expect(getNormalisedMatchScore("AC/DC Live", "acdc")).toBe(1);
    expect(getNormalisedMatchScore("The Weeknd", "weeknd")).toBe(2);
    expect(getNormalisedMatchScore("Drake", "Drak e")).toBe(3);
  });
});
