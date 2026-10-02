import { describe, it, expect } from "vitest";
import { fallbackDisplayName } from "@/lib/links/fallbackDisplayName";

describe("fallbackDisplayName", () => {
  it("capitalizes the column name", () => {
    expect(fallbackDisplayName("soundcloud")).toBe("Soundcloud");
    expect(fallbackDisplayName("x")).toBe("X");
  });
});
