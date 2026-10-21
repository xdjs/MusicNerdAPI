import { describe, it, expect } from "vitest";
import { needsUserName } from "@/lib/account/needsUserName";

describe("needsUserName", () => {
  it.each([
    [{ username: null }, true],
    [{ username: "  " }, true],
    [{ username: "someone@example.test" }, true],
    [{ username: "0xABC", wallet: "0xabc" }, true],
    [{ username: "Aux Bandit", wallet: "0xabc" }, false],
  ])("%j → %s", (user, expected) => {
    expect(needsUserName(user)).toBe(expected);
  });
});
