import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), exec: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: m.auth,
}));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.exec } }));
const { mutateBookmarksHandler } = await import("@/lib/bookmarks/mutateBookmarksHandler");

const req = (body: unknown) =>
  new Request("https://api/api/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bookmark-Account": "u1" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
  m.exec.mockResolvedValue([]);
});

describe("mutateBookmarksHandler", () => {
  it("returns 401 when not authenticated", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({ status: "error" }, { status: 401 }));
    const res = await mutateBookmarksHandler(req({ artistIds: [] }), "POST");
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const res = await mutateBookmarksHandler(req({ invalid: true }), "POST");
    expect(res.status).toBe(400);
  });

  it("rejects unexpected query parameters", async () => {
    const r = new Request("https://api/api/bookmarks?x=1", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bookmark-Account": "u1" },
      body: JSON.stringify({ artistIds: [] }),
    });
    const res = await mutateBookmarksHandler(r, "POST");
    expect(res.status).toBe(400);
  });
});
