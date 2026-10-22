import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postRevokeMcpKeyHandler } from "@/lib/mcpKeys/postRevokeMcpKeyHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), revoke: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/mcpKeys/revokeMcpKey", () => ({ revokeMcpKey: mock.revoke }));

const id = "f03cf36d-ca06-43db-9fd1-a4b73c636bd7";
const request = new Request(`https://api.musicnerd.test/api/admin/mcp-keys/${id}/revoke`, {
  method: "POST",
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("postRevokeMcpKeyHandler", () => {
  it("revokes the key", async () => {
    mock.revoke.mockResolvedValueOnce(true);
    const res = await postRevokeMcpKeyHandler(request, id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", message: "Key revoked" });
    expect(mock.revoke).toHaveBeenCalledWith(id);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("is 404 when no active key matched", async () => {
    mock.revoke.mockResolvedValueOnce(false);
    const res = await postRevokeMcpKeyHandler(request, id);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ status: "error", error: "Key not found" });
  });

  it("is 400 for a non-UUID id, without touching the database", async () => {
    const res = await postRevokeMcpKeyHandler(request, "nope");
    expect(res.status).toBe(400);
    expect(mock.revoke).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    expect((await postRevokeMcpKeyHandler(request, id)).status).toBe(403);
  });

  it("answers a database failure with MusicNerdWeb's 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.revoke.mockRejectedValueOnce(new Error("db down"));
    const res = await postRevokeMcpKeyHandler(request, id);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
