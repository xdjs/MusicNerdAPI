import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { hashApiKey } from "@/lib/mcpAuth/hashApiKey";

const { auth, execute } = vi.hoisted(() => ({ auth: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/authenticateAdmin", () => ({ authenticateAdmin: auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { postMcpKeyHandler } = await import("@/lib/mcpKeys/postMcpKeyHandler");

const req = (body: unknown) =>
  new Request("https://x/api/admin/mcp-keys", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  auth.mockReset().mockResolvedValue({ userId: "admin" });
  execute.mockReset().mockResolvedValue([]);
});

describe("postMcpKeyHandler", () => {
  it("stores only the hash and returns the raw key once", async () => {
    const res = await postMcpKeyHandler(req({ label: "  worker  " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", label: "worker" });
    expect(body.rawKey).toMatch(/^[0-9a-f]{64}$/);
    const params = execute.mock.calls[0][0].queryChunks.filter(
      (c: unknown) => typeof c === "string",
    );
    expect(params).toEqual([hashApiKey(body.rawKey), "worker"]);
  });

  it.each([[{}], [{ label: "   " }], [{ label: 5 }]])("is a 400 for %j", async body => {
    const res = await postMcpKeyHandler(req(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Label is required" });
  });

  it("passes through the auth failure", async () => {
    auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await postMcpKeyHandler(req({ label: "x" }))).status).toBe(401);
  });
});
