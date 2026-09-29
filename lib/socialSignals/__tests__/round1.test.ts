import { describe, it, expect } from "vitest";
import { round1 } from "@/lib/socialSignals/round1";

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(7.068)).toBe(7.1);
    expect(round1(3)).toBe(3);
  });
});
