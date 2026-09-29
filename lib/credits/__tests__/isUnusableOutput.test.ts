import { describe, it, expect } from "vitest";
import { isUnusableOutput } from "@/lib/credits/isUnusableOutput";

describe("isUnusableOutput", () => {
  it("recognises the AI SDK's no-object and no-output errors", () => {
    expect(
      isUnusableOutput(Object.assign(new Error("x"), { name: "AI_NoObjectGeneratedError" })),
    ).toBe(true);
    expect(
      isUnusableOutput(Object.assign(new Error("x"), { name: "AI_NoOutputGeneratedError" })),
    ).toBe(true);
  });

  it("does not treat a timeout, a network error or nothing as unusable output", () => {
    expect(isUnusableOutput(new Error("caption extraction timed out"))).toBe(false);
    expect(isUnusableOutput(null)).toBe(false);
  });
});
