import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ consume: vi.fn(), pair: vi.fn() }));
vi.mock("@/lib/oauth/consumeOAuthToken", () => ({ consumeOAuthToken: mock.consume }));
vi.mock("@/lib/oauth/issueTokenPair", () => ({ issueTokenPair: mock.pair }));
const { exchangeAuthorizationCode } = await import("@/lib/oauth/exchangeAuthorizationCode");

// RFC 7636 appendix B.
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const redirect = "http://127.0.0.1:33418/callback";
const form = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "c1",
    code: "mn_code_abc",
    code_verifier: verifier,
    redirect_uri: redirect,
    ...over,
  });
const pair = { access_token: "mn_at_x" };
const errorOf = async (res: unknown) => {
  expect(res).toBeInstanceOf(NextResponse);
  return ((await (res as NextResponse).json()) as { error: string }).error;
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.consume.mockResolvedValue({
    grantId: "grant-1",
    clientId: "c1",
    codeChallenge: challenge,
    redirectUri: redirect,
  });
  mock.pair.mockResolvedValue(pair);
});

describe("exchangeAuthorizationCode", () => {
  it("consumes the code and issues a token pair for its grant", async () => {
    expect(await exchangeAuthorizationCode(form())).toBe(pair);
    expect(mock.consume).toHaveBeenCalledWith("mn_code_abc", "code");
    expect(mock.pair).toHaveBeenCalledWith("grant-1");
  });

  it("is invalid_grant for an unknown, expired or used code", async () => {
    mock.consume.mockResolvedValue(undefined);
    expect(await errorOf(await exchangeAuthorizationCode(form()))).toBe("invalid_grant");
    expect(mock.pair).not.toHaveBeenCalled();
  });

  it.each([
    ["the wrong verifier", { code_verifier: `${verifier.slice(0, -1)}A` }],
    ["the challenge as the verifier", { code_verifier: challenge }],
    ["another redirect_uri", { redirect_uri: "http://127.0.0.1:33418/other" }],
    ["another client", { client_id: "c2" }],
  ])("is invalid_grant for %s", async (_label, over) => {
    expect(await errorOf(await exchangeAuthorizationCode(form(over)))).toBe("invalid_grant");
    expect(mock.pair).not.toHaveBeenCalled();
  });

  it.each(["code", "code_verifier", "redirect_uri"])(
    "is invalid_request without %s",
    async field => {
      const params = form();
      params.delete(field);
      expect(await errorOf(await exchangeAuthorizationCode(params))).toBe("invalid_request");
      expect(mock.consume).not.toHaveBeenCalled();
    },
  );
});
