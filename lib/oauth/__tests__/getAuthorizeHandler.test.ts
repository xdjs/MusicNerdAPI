import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { validate } = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("@/lib/oauth/validateAuthorizeRequest", () => ({ validateAuthorizeRequest: validate }));
const { getAuthorizeHandler } = await import("@/lib/oauth/getAuthorizeHandler");

const query =
  "response_type=code&client_id=c1&redirect_uri=http%3A%2F%2F127.0.0.1%3A33418%2Fcallback&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256&state=xyz";
const authorize = () =>
  getAuthorizeHandler(new Request(`https://api.musicnerd.net/api/oauth/auth?${query}`));

beforeEach(() => {
  validate.mockReset();
  vi.stubEnv("OAUTH_CONSENT_URL", "https://staging.musicnerd.net/oauth/authorize");
});
afterEach(() => vi.unstubAllEnvs());

describe("getAuthorizeHandler", () => {
  it("redirects a valid request to the consent page with the same query", async () => {
    validate.mockResolvedValue({ ok: true });
    const res = await authorize();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `https://staging.musicnerd.net/oauth/authorize?${query}`,
    );
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "c1", state: "xyz" }),
      "https://api.musicnerd.net",
    );
  });

  it("is a 400 OAuth error, not a redirect, for an unknown client or redirect", async () => {
    validate.mockResolvedValue({ ok: false, redirectUri: null });
    const res = await authorize();
    expect(res.status).toBe(400);
    expect(res.headers.get("Location")).toBeNull();
    expect(await res.json()).toEqual({
      error: "invalid_request",
      error_description: "Unknown client or redirect_uri",
    });
  });

  it("redirects any other invalid request back to the client with the error, state and issuer", async () => {
    validate.mockResolvedValue({
      ok: false,
      redirectUri: "http://127.0.0.1:33418/callback",
      error: "invalid_request",
      description: "PKCE with S256 is required",
      state: "xyz",
    });
    const res = await authorize();
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("http://127.0.0.1:33418/callback");
    expect(Object.fromEntries(location.searchParams)).toEqual({
      error: "invalid_request",
      error_description: "PKCE with S256 is required",
      state: "xyz",
      iss: "https://api.musicnerd.net/api/oauth",
    });
  });

  it("is a 500 server_error when the consent page isn't configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("OAUTH_CONSENT_URL", "");
    validate.mockResolvedValue({ ok: true });
    const res = await authorize();
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe("server_error");
  });
});
