import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { postMcpKeysHandler } from "@/lib/mcpKeys/postMcpKeysHandler";

const mock = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: mock.auth }));
vi.mock("@/lib/mcpKeys/createMcpKey", () => ({ createMcpKey: mock.create }));

const request = (body: string) =>
  new Request("https://api.musicnerd.test/api/admin/mcp-keys", { method: "POST", body });

beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ userId: "admin" });
});

describe("postMcpKeysHandler", () => {
  it("creates the key and returns it with 201", async () => {
    mock.create.mockResolvedValueOnce({ rawKey: "raw", label: "mapping-worker" });
    const res = await postMcpKeysHandler(request('{"label":" mapping-worker "}'));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: "ok", rawKey: "raw", label: "mapping-worker" });
    expect(mock.create).toHaveBeenCalledWith("mapping-worker");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects a blank label before creating anything", async () => {
    const res = await postMcpKeysHandler(request('{"label":""}'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Label is required" });
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("forwards the admin check's response", async () => {
    mock.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    expect((await postMcpKeysHandler(request('{"label":"x"}'))).status).toBe(401);
  });

  it("answers a database failure with MusicNerdWeb's 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock.create.mockRejectedValueOnce(new Error("db down"));
    const res = await postMcpKeysHandler(request('{"label":"x"}'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Internal server error" });
  });
});
