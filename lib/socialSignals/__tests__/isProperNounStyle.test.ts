import { describe, it, expect } from "vitest";
import { isProperNounStyle } from "@/lib/socialSignals/isProperNounStyle";

describe("isProperNounStyle", () => {
  it("is true for Title-case and false for shouting or lowercase", () => {
    expect(isProperNounStyle("Colombia")).toBe(true);
    expect(isProperNounStyle("HOUSE")).toBe(false);
    expect(isProperNounStyle("house")).toBe(false);
  });
});
