import { describe, it, expect } from "vitest";
import { matchesProfileUpdateFilter } from "@/lib/profile/matchesProfileUpdateFilter";

describe("matchesProfileUpdateFilter", () => {
  it("All keeps every kind", () => {
    for (const kind of ["release", "instagram", "moment", "interview"]) {
      expect(matchesProfileUpdateFilter(kind, "All")).toBe(true);
    }
  });

  it.each([
    ["Release", "release", true],
    ["Release", "instagram", false],
    ["Socials", "instagram", true],
    ["Socials", "moment", true],
    ["Socials", "interview", false],
    ["Lore", "interview", true],
    ["Lore", "release", false],
    ["Instagram", "instagram", true],
    ["Interview", "interview", true],
    ["In-Process", "moment", true],
    ["In-Process", "instagram", false],
  ])("%s keeps %s: %s", (filter, kind, expected) => {
    expect(matchesProfileUpdateFilter(kind, filter)).toBe(expected);
  });

  it("an unknown filter keeps nothing", () => {
    expect(matchesProfileUpdateFilter("release", "Everything")).toBe(false);
    expect(matchesProfileUpdateFilter("release", "toString")).toBe(false);
  });
});
