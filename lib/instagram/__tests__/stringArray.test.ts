import { describe, it, expect } from "vitest";
import { stringArray } from "@/lib/instagram/stringArray";

describe("stringArray", () => {
  it("keeps only non-empty strings", () => {
    expect(stringArray(["a", "", 3, null, "b"])).toEqual(["a", "b"]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(stringArray("a")).toEqual([]);
    expect(stringArray(undefined)).toEqual([]);
  });
});
