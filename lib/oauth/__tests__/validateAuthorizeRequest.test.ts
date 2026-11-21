import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOAuthClient } = vi.hoisted(() => ({ findOAuthClient: vi.fn() }));
vi.mock("@/lib/oauth/findOAuthClient", () => ({ findOAuthClient }));
const { validateAuthorizeRequest } = await import("@/lib/oauth/validateAuthorizeRequest");

const origin = "https://api.musicnerd.net";
const client = {
  id: "client-1",
  name: "Claude",
  redirectUris: ["http://127.0.0.1:33418/callback"],
};
const params = {
  response_type: "code",
  client_id: "client-1",
  redirect_uri: "http://127.0.0.1:33418/callback",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  state: "af0ifjsldkj",
};

beforeEach(() => {
  findOAuthClient.mockReset();
  findOAuthClient.mockResolvedValue(client);
});

describe("validateAuthorizeRequest", () => {
  it("accepts a valid request, with the documented scope and resource", async () => {
    expect(
      await validateAuthorizeRequest(
        { ...params, scope: "mcp:tools", resource: `${origin}/mcp` },
        origin,
      ),
    ).toEqual({
      ok: true,
      client,
      redirectUri: params.redirect_uri,
      codeChallenge: params.code_challenge,
      state: "af0ifjsldkj",
    });
    expect(findOAuthClient).toHaveBeenCalledWith("client-1");
  });

  it("has no state when the client sent none", async () => {
    const result = await validateAuthorizeRequest({ ...params, state: undefined }, origin);
    expect(result).toMatchObject({ ok: true, state: null });
  });

  it("never redirects for an unknown client", async () => {
    findOAuthClient.mockResolvedValue(undefined);
    expect(await validateAuthorizeRequest(params, origin)).toEqual({
      ok: false,
      redirectUri: null,
    });
  });

  it.each([
    ["an unregistered redirect", "http://127.0.0.1:33418/other"],
    ["the same redirect on another port", "http://127.0.0.1:9999/callback"],
    ["a trailing slash", "http://127.0.0.1:33418/callback/"],
    ["an extra query", "http://127.0.0.1:33418/callback?x=1"],
    ["no redirect", undefined],
  ])("never redirects for %s: the redirect URI must match exactly", async (_label, redirect) => {
    expect(await validateAuthorizeRequest({ ...params, redirect_uri: redirect }, origin)).toEqual({
      ok: false,
      redirectUri: null,
    });
  });

  it.each([
    ["no code challenge", { code_challenge: undefined }, "invalid_request"],
    ["the plain method", { code_challenge_method: "plain" }, "invalid_request"],
    ["no method", { code_challenge_method: undefined }, "invalid_request"],
    ["a malformed challenge", { code_challenge: "short" }, "invalid_request"],
    ["another response type", { response_type: "token" }, "unsupported_response_type"],
    ["an unknown scope", { scope: "mcp:tools admin" }, "invalid_scope"],
    ["another resource", { resource: "https://evil.example/mcp" }, "invalid_target"],
  ])("sends %s back to the client as %s, with the state", async (_label, change, error) => {
    expect(await validateAuthorizeRequest({ ...params, ...change }, origin)).toEqual({
      ok: false,
      redirectUri: params.redirect_uri,
      error,
      description: expect.any(String),
      state: "af0ifjsldkj",
    });
  });

  it("reads only text parameters from a JSON body", async () => {
    expect(await validateAuthorizeRequest({ ...params, client_id: 5 }, origin)).toEqual({
      ok: false,
      redirectUri: null,
    });
  });
});
