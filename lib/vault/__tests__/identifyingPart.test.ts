import { describe, it, expect } from "vitest";
import { identifyingPart } from "@/lib/vault/identifyingPart";

describe("identifyingPart", () => {
  it("is the handle itself, lowercased and without an @", () => {
    expect(identifyingPart(" @P3T3Rango ")).toBe("p3t3rango");
  });

  it("is a stored url's longest path segment, so two urls for one profile compare equal", () => {
    expect(identifyingPart("https://www.facebook.com/people/Angela-Bofill/100044180243805/")).toBe(
      "100044180243805",
    );
  });
});
