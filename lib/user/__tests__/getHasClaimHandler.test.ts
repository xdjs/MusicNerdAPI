import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getHasClaimHandler } = await import("@/lib/user/getHasClaimHandler");

const req = () => new Request("https://api/api/user/has-claim");
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("getHasClaimHandler", () => {
  it("returns hasClaim true when the user has an approved claim", async () => {
    m.exec.mockResolvedValueOnce([{ artist_id: "a1" }]);
    const res = await getHasClaimHandler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hasClaim: true, artistId: "a1" });
  });

  it("returns hasClaim false when no approved claim", async () => {
    m.exec.mockResolvedValueOnce([]);
    const res = await getHasClaimHandler(req());
    expect(await res.json()).toEqual({ hasClaim: false, artistId: null });
  });

  it("returns hasClaim false when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await getHasClaimHandler(req());
    expect(await res.json()).toEqual({ hasClaim: false, artistId: null });
  });
});
