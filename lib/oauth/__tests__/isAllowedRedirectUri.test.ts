import { describe, expect, it } from "vitest";
import { isAllowedRedirectUri } from "@/lib/oauth/isAllowedRedirectUri";

describe("isAllowedRedirectUri", () => {
  it.each([
    "https://claude.ai/api/mcp/auth_callback",
    "http://127.0.0.1:33418/callback",
    "http://localhost:6274/oauth/callback",
  ])("allows %s", uri => expect(isAllowedRedirectUri(uri)).toBe(true));

  it.each([
    ["http on another host", "http://example.com/callback"],
    ["a fragment", "https://example.com/callback#x"],
    ["an empty fragment", "https://example.com/callback#"],
    ["another scheme", "javascript:alert(1)"],
    ["not a URL", "callback"],
  ])("refuses %s", (_label, uri) => expect(isAllowedRedirectUri(uri)).toBe(false));
});
