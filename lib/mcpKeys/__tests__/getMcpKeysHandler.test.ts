import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { getMcpKeysHandler } from "@/lib/mcpKeys/getMcpKeysHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), keys: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/mcpKeys/getAllMcpKeys", () => ({ getAllMcpKeys: mock.keys }));

const request = new Request("https://api.musicnerd.test/api/admin/mcp-keys");

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("getMcpKeysHandler", () => {
  it("returns the keys as a bare array with CORS headers", async () => {
    const keys = [
      { id: "k1", label: "a", keyHashPrefix: "5b9720ab", createdAt: "t", revokedAt: null },
    ];
    mock.keys.mockResolvedValueOnce(keys);
    const res = await getMcpKeysHandler(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(keys);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("forwards the admin check's 401 or 403", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    const res = await getMcpKeysHandler(request);
    expect(res.status).toBe(403);
    expect(mock.keys).not.toHaveBeenCalled();
  });

  it("answers a database failure with MusicNerdWeb's 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.keys.mockRejectedValueOnce(new Error("db down"));
    const res = await getMcpKeysHandler(request);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
