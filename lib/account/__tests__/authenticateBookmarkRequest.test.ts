import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const authenticateRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
const { authenticateBookmarkRequest } = await import("@/lib/account/authenticateBookmarkRequest");

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const request = (
  headers: Record<string, string> = {},
  url = "https://api.musicnerd.test/api/bookmarks",
) => new Request(url, { headers });

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: USER });
});

describe("authenticateBookmarkRequest", () => {
  it("returns the token's user", async () => {
    expect(await authenticateBookmarkRequest(request(), false)).toBe(USER);
    expect(await authenticateBookmarkRequest(request({ "X-Bookmark-Account": USER }), true)).toBe(
      USER,
    );
  });

  it("forwards the 401 with private no-store caching", async () => {
    authenticateRequest.mockResolvedValue(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const res = await authenticateBookmarkRequest(request({ "X-Bookmark-Account": USER }), true);
    expect(res).toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) return;
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Authorization, X-Bookmark-Account");
  });

  it.each([true, false])(
    "rejects an account assertion from another user (mutation %s)",
    async mutation => {
      const res = await authenticateBookmarkRequest(
        request({ "X-Bookmark-Account": OTHER }),
        mutation,
      );
      expect(res).toBeInstanceOf(NextResponse);
      if (!(res instanceof NextResponse)) return;
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Account changed. Refresh before updating bookmarks.",
      });
    },
  );

  it("requires the account assertion on a write only", async () => {
    const res = await authenticateBookmarkRequest(request(), true);
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) expect(res.status).toBe(409);
    expect(await authenticateBookmarkRequest(request(), false)).toBe(USER);
  });

  it("does not accept ownership in query parameters", async () => {
    const res = await authenticateBookmarkRequest(
      request({}, `https://api.musicnerd.test/api/bookmarks?userId=${OTHER}`),
      false,
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) return;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ status: "error", error: "Unexpected query parameters" });
  });
});
