import { describe, it, expect } from "vitest";
import { getUserDisplayName } from "@/lib/user/getUserDisplayName";

describe("getUserDisplayName", () => {
  it("returns the username when it exists", () => {
    expect(getUserDisplayName({ username: "sweetman", email: null, wallet: null })).toBe(
      "sweetman",
    );
  });

  it("returns Anonymous when username is null", () => {
    expect(getUserDisplayName({ username: null, email: null, wallet: "0xabc" })).toBe("Anonymous");
  });

  it("returns Anonymous when username is an email", () => {
    expect(getUserDisplayName({ username: "test@example.com", email: null, wallet: null })).toBe(
      "Anonymous",
    );
  });

  it("returns Anonymous when username matches the wallet", () => {
    expect(getUserDisplayName({ username: "0xABC", email: null, wallet: "0xabc" })).toBe(
      "Anonymous",
    );
  });

  it("returns Anonymous when username is empty", () => {
    expect(getUserDisplayName({ username: "", email: null, wallet: null })).toBe("Anonymous");
  });
});
