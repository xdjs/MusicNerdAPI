import { describe, it, expect } from "vitest";
import { needsUserName } from "@/lib/user/needsUserName";

describe("needsUserName", () => {
  it.each([
    [{ username: null }, true],
    [{ username: "  " }, true],
    [{ username: "me@example.com" }, true],
    [{ username: "0xABC", wallet: "0xabc" }, true],
    [{ username: "Pete", wallet: "0xabc" }, false],
  ])("%j → %s", (user, expected) => {
    expect(needsUserName(user)).toBe(expected);
  });
});
