import { describe, expect, it } from "vitest";
import { getAuthorizationServerMetadata } from "@/lib/oauth/getAuthorizationServerMetadata";

describe("getAuthorizationServerMetadata", () => {
  it("matches the documented example on the production origin", () => {
    expect(getAuthorizationServerMetadata("https://api.musicnerd.net")).toEqual({
      issuer: "https://api.musicnerd.net/api/oauth",
      authorization_endpoint: "https://api.musicnerd.net/api/oauth/auth",
      token_endpoint: "https://api.musicnerd.net/api/oauth/token",
      registration_endpoint: "https://api.musicnerd.net/api/oauth/reg",
      scopes_supported: ["mcp:tools"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      authorization_response_iss_parameter_supported: true,
    });
  });
});
