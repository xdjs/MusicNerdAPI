import { describe, it, expect } from "vitest";
import { validateUserName } from "@/lib/users/validateUserName";

describe("validateUserName", () => {
  it("accepts a plain name, trimmed", () => {
    expect(validateUserName("  Vinyl Otter ")).toBeNull();
  });

  it.each([
    ["an empty string", "", "User name is required."],
    ["whitespace only", "   ", "User name is required."],
    ["a non-string", 42, "User name is required."],
    ["undefined", undefined, "User name is required."],
    ["51 characters", "a".repeat(51), "User name must be 50 characters or less."],
    ["a control character", "Vinyl\u0007Otter", "User name contains invalid characters."],
    [
      "an email address",
      "someone@example.com",
      "Choose a user name instead of an email or wallet address.",
    ],
    [
      "a wallet address",
      `0x${"a".repeat(40)}`,
      "Choose a user name instead of an email or wallet address.",
    ],
  ])("refuses %s", (_label, value, message) => {
    expect(validateUserName(value)).toBe(message);
  });

  it("allows exactly 50 characters", () => {
    expect(validateUserName("a".repeat(50))).toBeNull();
  });
});
