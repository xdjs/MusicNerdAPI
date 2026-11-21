import { describe, expect, it } from "vitest";
import { generateToken } from "@/lib/oauth/generateToken";

describe("generateToken", () => {
  it.each([
    ["code", "mn_code_"],
    ["access", "mn_at_"],
    ["refresh", "mn_rt_"],
  ] as const)("prefixes a %s with %s and 32 random bytes in base64url", (kind, prefix) => {
    const token = generateToken(kind);
    expect(token.startsWith(prefix)).toBe(true);
    expect(token.slice(prefix.length)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    expect(generateToken("access")).not.toBe(generateToken("access"));
  });
});
