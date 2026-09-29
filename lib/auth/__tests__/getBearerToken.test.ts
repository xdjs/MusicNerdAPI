import { describe, it, expect } from "vitest";
import { getBearerToken } from "@/lib/auth/getBearerToken";

const req = (auth?: string) =>
  new Request("https://x/y", { headers: auth ? { Authorization: auth } : {} });

describe("getBearerToken", () => {
  it("reads the token after Bearer, case-insensitively, trimmed", () => {
    expect(getBearerToken(req("Bearer abc.def"))).toBe("abc.def");
    expect(getBearerToken(req("bearer   abc  "))).toBe("abc");
  });

  it("is null without a Bearer token", () => {
    expect(getBearerToken(req())).toBeNull();
    expect(getBearerToken(req("Basic abc"))).toBeNull();
    expect(getBearerToken(req("Bearer "))).toBeNull();
  });
});
