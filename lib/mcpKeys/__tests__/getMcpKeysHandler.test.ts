import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, execute } = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getMcpKeysHandler } = await import("@/lib/mcpKeys/getMcpKeysHandler");

const req = () => new Request("https://x/api/admin/mcp-keys");

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  execute.mockReset();
});

describe("getMcpKeysHandler", () => {
  it("returns keys with only an 8-character hash prefix", async () => {
    execute.mockResolvedValueOnce([
      { id: "k1", label: "bot", key_hash: "abcdef0123456789", created_at: "t", revoked_at: null },
    ]);
    const res = await getMcpKeysHandler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      keys: [
        { id: "k1", label: "bot", keyHashPrefix: "abcdef01", createdAt: "t", revokedAt: null },
      ],
    });
  });

  it("passes through the auth failure", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 403 }));
    expect((await getMcpKeysHandler(req())).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it("is a 500 when the query fails", async () => {
    execute.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await getMcpKeysHandler(req())).status).toBe(500);
  });
});
