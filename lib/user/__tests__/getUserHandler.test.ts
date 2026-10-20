import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getUserHandler } = await import("@/lib/user/getUserHandler");

const req = () => new Request("https://api/api/user/u1");
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("getUserHandler", () => {
  it("returns the user row for the owner", async () => {
    m.exec.mockResolvedValueOnce([{ id: "u1", username: "Pete" }]);
    const res = await getUserHandler(req(), "u1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "u1", username: "Pete" });
  });

  it("returns 403 for a different user", async () => {
    const res = await getUserHandler(req(), "u2");
    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await getUserHandler(req(), "u1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    m.exec.mockResolvedValueOnce([]);
    const res = await getUserHandler(req(), "u1");
    expect(res.status).toBe(404);
  });
});
