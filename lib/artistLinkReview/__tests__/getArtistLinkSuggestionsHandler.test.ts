import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const m = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/artistLinkReview/getArtistLinkSuggestions", () => ({
  getArtistLinkSuggestions: m.list,
}));
const { getArtistLinkSuggestionsHandler } =
  await import("@/lib/artistLinkReview/getArtistLinkSuggestionsHandler");

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const get = (qs = "", artistId = id) =>
  getArtistLinkSuggestionsHandler(
    new Request(`https://api.test/api/artist/${artistId}/link-suggestions${qs}`),
    artistId,
  );

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ userId: "u1" });
});

describe("getArtistLinkSuggestionsHandler", () => {
  it("returns the page, never cached", async () => {
    m.list.mockResolvedValue({ items: [], hasMore: false, nextOffset: null });
    const res = await get("?offset=100");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", items: [], hasMore: false, nextOffset: null });
    expect(m.list).toHaveBeenCalledWith(id, "u1", 100);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes 401 through and 400s a bad id", async () => {
    m.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await get()).status).toBe(401);
    expect((await get("", "nope")).status).toBe(400);
  });

  it("403s anyone but the claimant or an admin, 500s a failure", async () => {
    m.list.mockRejectedValueOnce(new OwnershipChangedError());
    const denied = await get();
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.list.mockRejectedValueOnce(new Error("db"));
    const failed = await get();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({
      status: "error",
      error: "Could not load link suggestions",
    });
    log.mockRestore();
  });
});
