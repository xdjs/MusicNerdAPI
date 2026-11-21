import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ find: vi.fn(), touch: vi.fn() }));
vi.mock("@/lib/oauth/findGrantByAccessToken", () => ({ findGrantByAccessToken: mock.find }));
vi.mock("@/lib/oauth/touchOAuthGrant", () => ({ touchOAuthGrant: mock.touch }));
const { authenticateMcpRequest } = await import("@/lib/mcp/authenticateMcpRequest");

const request = (auth?: string) =>
  new Request("https://api.musicnerd.net/mcp", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });
const grant = { grantId: "grant-1", userId: "user-1", isAdmin: true, email: "S@Example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TEAM_ALLOWED_EMAILS", "sweetman=s@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticateMcpRequest", () => {
  it("resolves a valid access token to the user, role, team member and grant, and marks the grant used", async () => {
    mock.find.mockResolvedValue(grant);
    expect(await authenticateMcpRequest(request("Bearer mn_at_x"))).toEqual({
      userId: "user-1",
      isAdmin: true,
      member: "sweetman",
      grantId: "grant-1",
    });
    expect(mock.find).toHaveBeenCalledWith("mn_at_x");
    expect(mock.touch).toHaveBeenCalledWith("grant-1");
  });

  it("has no member for a user off the team or without an email", async () => {
    mock.find.mockResolvedValue({ ...grant, isAdmin: false, email: "fan@example.com" });
    expect(await authenticateMcpRequest(request("Bearer t"))).toMatchObject({
      isAdmin: false,
      member: null,
    });
    mock.find.mockResolvedValue({ ...grant, email: null });
    expect(await authenticateMcpRequest(request("Bearer t"))).toMatchObject({ member: null });
  });

  it.each([
    ["no token", undefined],
    ["an unknown, expired or revoked token", "Bearer mn_at_gone"],
  ])("answers %s with a 401 pointing at the resource metadata", async (_label, auth) => {
    mock.find.mockResolvedValue(undefined);
    const res = await authenticateMcpRequest(request(auth));
    expect(res).toBeInstanceOf(Response);
    const response = res as Response;
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer resource_metadata="https://api.musicnerd.net/.well-known/oauth-protected-resource/mcp"',
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe("WWW-Authenticate");
    expect(await response.json()).toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Unauthorized" },
      id: null,
    });
    expect(mock.touch).not.toHaveBeenCalled();
  });
});
