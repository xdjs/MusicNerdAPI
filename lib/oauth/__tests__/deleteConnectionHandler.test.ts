import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({ auth: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: mock.auth }));
vi.mock("@/lib/oauth/deleteOAuthGrant", () => ({ deleteOAuthGrant: mock.del }));
const { deleteConnectionHandler } = await import("@/lib/oauth/deleteConnectionHandler");

const request = () =>
  new Request("https://api.musicnerd.net/api/oauth/connections/g1", { method: "DELETE" });

beforeEach(() => vi.clearAllMocks());

describe("deleteConnectionHandler", () => {
  it("deletes the connection as the caller and answers ok", async () => {
    mock.auth.mockResolvedValue({ userId: "user-1" });
    const res = await deleteConnectionHandler(request(), "g1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(mock.del).toHaveBeenCalledWith("g1", "user-1");
  });

  it("forwards the 401", async () => {
    mock.auth.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await deleteConnectionHandler(request(), "g1")).status).toBe(401);
    expect(mock.del).not.toHaveBeenCalled();
  });

  it("is a 500 when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.auth.mockResolvedValue({ userId: "user-1" });
    mock.del.mockRejectedValue(new Error("db down"));
    expect((await deleteConnectionHandler(request(), "g1")).status).toBe(500);
  });
});
