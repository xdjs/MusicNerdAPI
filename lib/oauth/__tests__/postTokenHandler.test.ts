import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ exchange: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/oauth/exchangeAuthorizationCode", () => ({
  exchangeAuthorizationCode: mock.exchange,
}));
vi.mock("@/lib/oauth/refreshAccessToken", () => ({ refreshAccessToken: mock.refresh }));
const { postTokenHandler } = await import("@/lib/oauth/postTokenHandler");

const pair = {
  access_token: "mn_at_x",
  token_type: "Bearer",
  expires_in: 300,
  refresh_token: "mn_rt_x",
  scope: "mcp:tools",
};
const token = (body: Record<string, string>) =>
  postTokenHandler(
    new Request("https://api.musicnerd.net/api/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mock.exchange.mockResolvedValue(pair);
  mock.refresh.mockResolvedValue(pair);
});

describe("postTokenHandler", () => {
  it("swaps a code for a token pair, uncached", async () => {
    const res = await token({ grant_type: "authorization_code", client_id: "c1", code: "x" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pair);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((mock.exchange.mock.calls[0][0] as URLSearchParams).get("code")).toBe("x");
  });

  it("swaps a refresh token for a new pair", async () => {
    const res = await token({ grant_type: "refresh_token", client_id: "c1", refresh_token: "r" });
    expect(res.status).toBe(200);
    expect(mock.refresh).toHaveBeenCalledTimes(1);
  });

  it("passes on the grant's OAuth error", async () => {
    mock.exchange.mockResolvedValue(NextResponse.json({ error: "invalid_grant" }, { status: 400 }));
    const res = await token({ grant_type: "authorization_code", client_id: "c1" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_grant" });
  });

  it("is invalid_request without a client_id", async () => {
    const res = await token({ grant_type: "authorization_code" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_request");
    expect(mock.exchange).not.toHaveBeenCalled();
  });

  it("is unsupported_grant_type for any other grant", async () => {
    const res = await token({ grant_type: "client_credentials", client_id: "c1" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unsupported_grant_type");
  });

  it("is a 500 server_error when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.refresh.mockRejectedValue(new Error("db down"));
    const res = await token({ grant_type: "refresh_token", client_id: "c1", refresh_token: "r" });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe("server_error");
  });
});
