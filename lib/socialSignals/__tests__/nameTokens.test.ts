import { describe, it, expect } from "vitest";
import { nameTokens } from "@/lib/socialSignals/nameTokens";

describe("nameTokens", () => {
  it("splits a name into lowercase words of two letters or more", () => {
    expect([...nameTokens("Pete Rango")]).toEqual(["pete", "rango"]);
    expect([...nameTokens("")]).toEqual([]);
  });
});
