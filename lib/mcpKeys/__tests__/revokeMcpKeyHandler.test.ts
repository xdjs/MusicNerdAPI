import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { auth, execute } = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { revokeMcpKeyHandler } = await import("@/lib/mcpKeys/revokeMcpKeyHandler");

const req = () => new Request("https://x/api/admin/mcp-keys/k1/revoke", { method: "POST" });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  execute.mockReset();
});

describe("revokeMcpKeyHandler", () => {
  it("revokes a live key", async () => {
    execute.mockResolvedValueOnce([{ id: "k1" }]);
    const res = await revokeMcpKeyHandler(req(), "k1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", message: "Key revoked" });
  });

  it("is a 404 for a missing or already revoked key", async () => {
    execute.mockResolvedValueOnce([]);
    const res = await revokeMcpKeyHandler(req(), "k1");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Key not found" });
  });

  it("passes through the auth failure", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await revokeMcpKeyHandler(req(), "k1")).status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
});
