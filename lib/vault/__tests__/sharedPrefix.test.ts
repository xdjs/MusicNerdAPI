import { describe, it, expect } from "vitest";
import { sharedPrefix } from "@/lib/vault/sharedPrefix";

describe("sharedPrefix", () => {
  it("counts the common opening run of the folded handle and name", () => {
    expect(sharedPrefix("dupesdidit", "Sherwinn Dupes Brice")).toBe(0);
    expect(sharedPrefix("peterango", "Pete Rango")).toBe(9);
    expect(sharedPrefix("p3t3rango", "Pete Rango")).toBe(1);
    expect(sharedPrefix("", "Pete")).toBe(0);
  });

  it("folds accents rather than dropping them", () => {
    // "Rós" folds to "ros", so the handle matches the whole name.
    expect(sharedPrefix("sigurros", "Sigur Rós")).toBe(8);
  });
});
