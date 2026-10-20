import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getProfileArtistsHandler } = await import(
  "@/lib/profile/getProfileArtistsHandler"
);

const req = (qs = "") =>
  new Request(`https://api/api/profile/artists${qs}`, {
    headers: { "X-Profile-Account": "u1" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.exec.mockResolvedValue([]);
});

describe("getProfileArtistsHandler", () => {
  it("returns 400 for invalid offset", async () => {
    const res = await getProfileArtistsHandler(req("?offset=abc"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(
      NextResponse.json({ status: "error" }, { status: 401 }),
    );
    const res = await getProfileArtistsHandler(req());
    expect(res.status).toBe(401);
  });

  it("returns artists for the user", async () => {
    m.exec
      .mockResolvedValueOnce([
        { id: "a1", name: "Artist 1", custom_image: null },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);
    const res = await getProfileArtistsHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artists).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});
