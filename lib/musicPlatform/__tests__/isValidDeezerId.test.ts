import { describe, it, expect } from "vitest";
import { isValidDeezerId } from "@/lib/musicPlatform/isValidDeezerId";

describe("isValidDeezerId", () => {
  it("accepts digits only", () => {
    expect(isValidDeezerId("94933462")).toBe(true);
    expect(isValidDeezerId("12a")).toBe(false);
    expect(isValidDeezerId("")).toBe(false);
  });
});
