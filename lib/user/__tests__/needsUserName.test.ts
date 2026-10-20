import { describe, it, expect } from "vitest";
import { needsUserName } from "@/lib/user/needsUserName";

describe("needsUserName", () => {
  it("returns true when username is null", () => {
    expect(needsUserName({ username: null, wallet: null })).toBe(true);
  });

  it("returns true when username is empty", () => {
    expect(needsUserName({ username: "", wallet: null })).toBe(true);
  });

  it("returns true when username is an email address", () => {
    expect(needsUserName({ username: "user@example.com", wallet: null })).toBe(true);
  });

  it("returns true when username matches the wallet address", () => {
    expect(needsUserName({ username: "0xABC123", wallet: "0xabc123" })).toBe(true);
  });

  it("returns false for a real username", () => {
    expect(needsUserName({ username: "sweetman", wallet: "0xabc" })).toBe(false);
  });
});
