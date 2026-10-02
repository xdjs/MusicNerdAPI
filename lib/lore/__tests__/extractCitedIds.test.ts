import { describe, it, expect } from "vitest";
import { extractCitedIds } from "@/lib/lore/extractCitedIds";

describe("extractCitedIds", () => {
  it("finds every marker id in a string", () => {
    expect([...extractCitedIds("a[1] b[2][5] c")].sort()).toEqual([1, 2, 5]);
  });

  it("is empty for text with no markers", () => {
    expect(extractCitedIds("plain [prose] here").size).toBe(0);
  });
});
