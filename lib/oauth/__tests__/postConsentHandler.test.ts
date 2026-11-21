import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  validate: vi.fn(),
  createGrant: vi.fn(),
  issue: vi.fn(),
}));
vi.mock("@/lib/oauth/authenticateConsentUser", () => ({ authenticateConsentUser: mock.auth }));
vi.mock("@/lib/oauth/validateAuthorizeRequest", () => ({
  validateAuthorizeRequest: mock.validate,
}));
vi.mock("@/lib/oauth/createOAuthGrant", () => ({ createOAuthGrant: mock.createGrant }));
vi.mock("@/lib/oauth/issueOAuthToken", () => ({ issueOAuthToken: mock.issue }));
const { postConsentHandler } = await import("@/lib/oauth/postConsentHandler");

const iss = "https://api.musicnerd.net/api/oauth";
const valid = {
  ok: true,
  client: { id: "c1", name: "Claude", redirectUris: [] },
  redirectUri: "http://127.0.0.1:33418/callback",
  codeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  state: "xyz",
};
const decide = (body: unknown) =>
  postConsentHandler(
    new Request("https://api.musicnerd.net/api/oauth/consent", {
      method: "POST",
      headers: { Authorization: "Bearer privy", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
const redirectOf = async (res: Response) => {
  const { redirectUrl } = (await res.json()) as { redirectUrl: string };
  const url = new URL(redirectUrl);
  return { base: url.origin + url.pathname, params: Object.fromEntries(url.searchParams) };
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "user-1" });
  mock.validate.mockResolvedValue(valid);
  mock.createGrant.mockResolvedValue("grant-1");
  mock.issue.mockResolvedValue("mn_code_abc");
});

describe("postConsentHandler", () => {
  it("on approve connects the agent and returns the redirect with code, state and iss", async () => {
    const res = await decide({ client_id: "c1", decision: "approve" });
    expect(res.status).toBe(200);
    expect(await redirectOf(res)).toEqual({
      base: "http://127.0.0.1:33418/callback",
      params: { code: "mn_code_abc", state: "xyz", iss },
    });
    expect(mock.validate).toHaveBeenCalledWith(
      { client_id: "c1", decision: "approve" },
      "https://api.musicnerd.net",
    );
    expect(mock.createGrant).toHaveBeenCalledWith("c1", "user-1");
    expect(mock.issue).toHaveBeenCalledWith("grant-1", "code", {
      codeChallenge: valid.codeChallenge,
      redirectUri: valid.redirectUri,
    });
  });

  it("on deny returns access_denied with the state, and connects nothing", async () => {
    const res = await decide({ client_id: "c1", decision: "deny" });
    expect(await redirectOf(res)).toEqual({
      base: "http://127.0.0.1:33418/callback",
      params: { error: "access_denied", state: "xyz", iss },
    });
    expect(mock.createGrant).not.toHaveBeenCalled();
  });

  it("forwards the 401 when the member isn't signed in", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await decide({ decision: "approve" })).status).toBe(401);
    expect(mock.createGrant).not.toHaveBeenCalled();
  });

  it.each([
    ["no decision", { client_id: "c1" }, valid],
    ["another decision", { client_id: "c1", decision: "maybe" }, valid],
    ["an invalid request", { decision: "approve" }, { ok: false, redirectUri: null }],
    [
      "missing PKCE",
      { decision: "approve" },
      { ok: false, redirectUri: "https://a.example/cb", error: "invalid_request", state: null },
    ],
  ])("is a 400 for %s", async (_label, body, validation) => {
    mock.validate.mockResolvedValue(validation);
    const res = await decide(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Invalid authorization request" });
    expect(mock.createGrant).not.toHaveBeenCalled();
  });

  it("is a 500 when the grant can't be stored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.createGrant.mockRejectedValue(new Error("db down"));
    expect((await decide({ decision: "approve" })).status).toBe(500);
  });
});
