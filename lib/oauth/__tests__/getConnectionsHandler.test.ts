import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/oauth/listOAuthConnections", () => ({ listOAuthConnections: mock.list }));
const { getConnectionsHandler } = await import("@/lib/oauth/getConnectionsHandler");

const request = () => new Request("https://api.musicnerd.net/api/oauth/connections");

beforeEach(() => vi.clearAllMocks());

describe("getConnectionsHandler", () => {
  it("lists the caller's own connections", async () => {
    const connections = [{ id: "g1", agent: "Claude", scopes: ["mcp:tools"] }];
    mock.auth.mockResolvedValue({ userId: "user-1" });
    mock.list.mockResolvedValue(connections);
    const res = await getConnectionsHandler(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", connections });
    expect(mock.list).toHaveBeenCalledWith("user-1");
  });

  it("forwards the 401", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await getConnectionsHandler(request())).status).toBe(401);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("is a 500 when the list can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.auth.mockResolvedValue({ userId: "user-1" });
    mock.list.mockRejectedValue(new Error("db down"));
    const res = await getConnectionsHandler(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
