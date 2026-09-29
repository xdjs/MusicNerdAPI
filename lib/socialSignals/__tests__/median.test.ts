import { describe, it, expect } from "vitest";
import { median } from "@/lib/socialSignals/median";

describe("median", () => {
  it("takes the middle value, averaging the two middles of an even list", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("is 0 for an empty list", () => {
    expect(median([])).toBe(0);
  });
});
