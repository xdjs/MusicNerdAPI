import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateClientRegistration } from "@/lib/oauth/validateClientRegistration";

const error = async (body: unknown) => {
  const res = validateClientRegistration(body);
  expect(res).toBeInstanceOf(NextResponse);
  expect((res as NextResponse).status).toBe(400);
  return ((await (res as NextResponse).json()) as { error: string }).error;
};

describe("validateClientRegistration", () => {
  it("reads the name and redirect URIs, ignoring the grant types and auth method", () => {
    expect(
      validateClientRegistration({
        client_name: " Claude ",
        redirect_uris: ["http://127.0.0.1:33418/callback", "https://claude.ai/cb"],
        grant_types: ["client_credentials"],
        token_endpoint_auth_method: "client_secret_post",
      }),
    ).toEqual({
      name: "Claude",
      redirectUris: ["http://127.0.0.1:33418/callback", "https://claude.ai/cb"],
    });
  });

  it("names a client that gave no name", () => {
    expect(validateClientRegistration({ redirect_uris: ["https://a.example/cb"] })).toEqual({
      name: "MCP client",
      redirectUris: ["https://a.example/cb"],
    });
  });

  it.each([
    ["missing", {}],
    ["empty", { redirect_uris: [] }],
    ["not a list", { redirect_uris: "https://a.example/cb" }],
    ["http on another host", { redirect_uris: ["http://example.com/cb"] }],
    ["with a fragment", { redirect_uris: ["https://a.example/cb#x"] }],
  ])("is invalid_redirect_uri when the redirect URIs are %s", async (_label, body) => {
    expect(await error(body)).toBe("invalid_redirect_uri");
  });

  it.each([
    ["not an object", "x"],
    ["null", null],
    [
      "a name over 200 characters",
      { client_name: "a".repeat(201), redirect_uris: ["https://a.example/cb"] },
    ],
    ["a name that isn't text", { client_name: 5, redirect_uris: ["https://a.example/cb"] }],
  ])("is invalid_client_metadata for a body %s", async (_label, body) => {
    expect(await error(body)).toBe("invalid_client_metadata");
  });
});
