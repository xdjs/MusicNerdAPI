import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  exec: vi.fn(),
  list: vi.fn(),
  createSignedUrl: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
vi.mock("@/lib/storage/getSupabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: () => ({
        list: m.list,
        createSignedUrl: m.createSignedUrl,
      }),
    },
  }),
}));
const { getUserProfileImageHandler } = await import("@/lib/user/getUserProfileImageHandler");

const req = () => new Request("https://api/api/user/profile-image");
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("getUserProfileImageHandler", () => {
  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await getUserProfileImageHandler(req());
    expect(res.status).toBe(401);
  });

  it("returns null url when no avatar exists", async () => {
    m.exec.mockResolvedValueOnce([{ id: "u1", privy_user_id: "p1" }]);
    m.list.mockResolvedValue({ data: [], error: null });
    const res = await getUserProfileImageHandler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: null });
  });
});
