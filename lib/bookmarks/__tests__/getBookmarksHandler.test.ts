import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { getBookmarksHandler } = await import("@/lib/bookmarks/getBookmarksHandler");

const req = () => new Request("https://api/api/bookmarks");
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("getBookmarksHandler", () => {
  it("returns the user bookmarks", async () => {
    m.exec.mockResolvedValueOnce([
      {
        artistId: "a1",
        artistName: "Test",
        imageUrl: null,
        deezer: "123",
      },
    ]);
    const res = await getBookmarksHandler(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("u1");
    expect(body.bookmarks).toHaveLength(1);
    expect(body.bookmarks[0].artistName).toBe("Test");
  });

  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await getBookmarksHandler(req());
    expect(res.status).toBe(401);
  });

  it("rejects unexpected query parameters", async () => {
    const res = await getBookmarksHandler(new Request("https://api/api/bookmarks?foo=bar"));
    expect(res.status).toBe(400);
  });
});
