import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { patchUserHandler } = await import("@/lib/user/patchUserHandler");

const req = (body: object) =>
  new Request("https://api/api/user/u1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.exec.mockResolvedValue([]);
});

describe("patchUserHandler", () => {
  it("updates the username", async () => {
    const res = await patchUserHandler(req({ username: "NewName" }), "u1");
    expect(res.status).toBe(200);
    expect(m.exec).toHaveBeenCalled();
  });

  it("returns 403 for a different user", async () => {
    const res = await patchUserHandler(req({ username: "X" }), "u2");
    expect(res.status).toBe(403);
  });

  it("returns 400 for empty username", async () => {
    const res = await patchUserHandler(req({ username: "" }), "u1");
    expect(res.status).toBe(400);
  });

  it("returns 409 when name is taken", async () => {
    m.exec.mockResolvedValueOnce([{ id: "other" }]);
    const res = await patchUserHandler(req({ username: "Taken" }), "u1");
    expect(res.status).toBe(409);
  });
});
