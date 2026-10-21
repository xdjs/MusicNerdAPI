import { describe, expect, it } from "vitest";
import { needsUserName } from "@/lib/users/needsUserName";

describe("needsUserName", () => {
  it("is true without a name, for an email used as one, or for the wallet repeated as one", () => {
    expect(needsUserName({ username: null })).toBe(true);
    expect(needsUserName({ username: "   " })).toBe(true);
    expect(needsUserName({ username: "private@example.test" })).toBe(true);
    expect(needsUserName({ username: " 0xAbC ", wallet: "0xabc" })).toBe(true);
  });

  it("is false for a chosen name", () => {
    expect(needsUserName({ username: "Aux Bandit", wallet: "0xabc" })).toBe(false);
  });
});
