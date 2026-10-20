import { describe, it, expect } from "vitest";
import { validateUserName } from "@/lib/user/validateUserName";

describe("validateUserName", () => {
  it("accepts a normal name", () => {
    expect(validateUserName("Sweetman")).toBeNull();
  });

  it("rejects empty strings", () => {
    expect(validateUserName("")).toBe("User name is required.");
    expect(validateUserName("   ")).toBe("User name is required.");
  });

  it("rejects names longer than 50 characters", () => {
    expect(validateUserName("a".repeat(51))).toBe("User name must be 50 characters or less.");
  });

  it("rejects control characters", () => {
    expect(validateUserName("bad\x00name")).toBe("User name contains invalid characters.");
  });

  it("rejects emails", () => {
    expect(validateUserName("user@example.com")).toBe(
      "Choose a user name instead of an email or wallet address.",
    );
  });

  it("rejects wallet addresses", () => {
    expect(validateUserName("0x" + "a".repeat(40))).toBe(
      "Choose a user name instead of an email or wallet address.",
    );
  });
});
