import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mock = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getUserBookmarks: vi.fn(),
  addUserBookmarks: vi.fn(),
  editUserBookmarks: vi.fn(),
  removeUserBookmark: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({
  authenticateRequest: mock.authenticateRequest,
}));
vi.mock("@/lib/account/getUserBookmarks", () => ({ getUserBookmarks: mock.getUserBookmarks }));
vi.mock("@/lib/account/addUserBookmarks", () => ({ addUserBookmarks: mock.addUserBookmarks }));
vi.mock("@/lib/account/editUserBookmarks", () => ({ editUserBookmarks: mock.editUserBookmarks }));
vi.mock("@/lib/account/removeUserBookmark", () => ({
  removeUserBookmark: mock.removeUserBookmark,
}));
const { getBookmarksHandler } = await import("@/lib/account/getBookmarksHandler");
const { postBookmarksHandler } = await import("@/lib/account/postBookmarksHandler");
const { patchBookmarksHandler } = await import("@/lib/account/patchBookmarksHandler");
const { deleteBookmarksHandler } = await import("@/lib/account/deleteBookmarksHandler");

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ARTIST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bookmarks = [{ artistId: ARTIST, artistName: "Artist", imageUrl: null }];
const handlers = {
  GET: getBookmarksHandler,
  POST: postBookmarksHandler,
  PATCH: patchBookmarksHandler,
  DELETE: deleteBookmarksHandler,
};
const bodies = {
  GET: undefined,
  POST: { artistIds: [ARTIST] },
  PATCH: { orderedArtistIds: [ARTIST], removedArtistIds: [] },
  DELETE: { artistId: ARTIST },
};
type Method = keyof typeof handlers;
const queries = [
  mock.getUserBookmarks,
  mock.addUserBookmarks,
  mock.editUserBookmarks,
  mock.removeUserBookmark,
];
const request = (
  method: Method,
  body: unknown = bodies[method],
  headers: Record<string, string> = { "X-Bookmark-Account": USER },
  url = "https://api.musicnerd.test/api/bookmarks",
) =>
  new Request(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  for (const fn of Object.values(mock)) fn.mockReset();
  mock.authenticateRequest.mockResolvedValue({ userId: USER });
  for (const query of queries) query.mockResolvedValue(bookmarks);
});

describe("/api/bookmarks handlers", () => {
  it.each(["GET", "POST", "PATCH", "DELETE"] as Method[])(
    "requires a signed-in user for %s, with private no-store caching",
    async method => {
      mock.authenticateRequest.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
      );
      const res = await handlers[method](request(method));
      expect(res.status).toBe(401);
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      for (const query of queries) expect(query).not.toHaveBeenCalled();
    },
  );

  it("returns only the token's user and a private no-store payload", async () => {
    const res = await getBookmarksHandler(request("GET", undefined, {}));
    expect(await res.json()).toEqual({ status: "ok", userId: USER, bookmarks });
    expect(mock.getUserBookmarks).toHaveBeenCalledWith(USER);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Authorization, X-Bookmark-Account");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it.each(["GET", "POST", "PATCH", "DELETE"] as Method[])(
    "rejects an account assertion from another user for %s",
    async method => {
      const res = await handlers[method](
        request(method, bodies[method], { "X-Bookmark-Account": OTHER }),
      );
      expect(res.status).toBe(409);
      for (const query of queries) expect(query).not.toHaveBeenCalled();
    },
  );

  it.each(["POST", "PATCH", "DELETE"] as Method[])(
    "requires an account assertion on %s",
    async method => {
      expect((await handlers[method](request(method, bodies[method], {}))).status).toBe(409);
    },
  );

  it("does not accept ownership in query parameters", async () => {
    const res = await getBookmarksHandler(
      request("GET", undefined, {}, `https://api.musicnerd.test/api/bookmarks?userId=${OTHER}`),
    );
    expect(res.status).toBe(400);
    expect(mock.getUserBookmarks).not.toHaveBeenCalled();
  });

  it("validates each write's body before writing", async () => {
    expect((await postBookmarksHandler(request("POST", { artistIds: ["bad"] }))).status).toBe(400);
    expect(
      (await patchBookmarksHandler(request("PATCH", { orderedArtistIds: [ARTIST] }))).status,
    ).toBe(400);
    expect((await deleteBookmarksHandler(request("DELETE", { artistId: "nope" }))).status).toBe(
      400,
    );
    for (const query of queries) expect(query).not.toHaveBeenCalled();
  });

  it("adds normalized ids using only token ownership and returns the persisted list", async () => {
    const res = await postBookmarksHandler(request("POST", { artistIds: [ARTIST.toUpperCase()] }));
    expect(await res.json()).toEqual({ status: "ok", userId: USER, bookmarks });
    expect(mock.addUserBookmarks).toHaveBeenCalledWith(USER, [ARTIST], false);
  });

  it("passes explicit removals and reorders without replacing the account list", async () => {
    expect((await patchBookmarksHandler(request("PATCH"))).status).toBe(200);
    expect(mock.editUserBookmarks).toHaveBeenCalledWith(USER, [ARTIST], []);
    expect((await deleteBookmarksHandler(request("DELETE"))).status).toBe(200);
    expect(mock.removeUserBookmark).toHaveBeenCalledWith(USER, ARTIST);
  });

  it("reports persistence failure without exposing database details", async () => {
    mock.addUserBookmarks.mockRejectedValue(new Error("private connection error"));
    const res = await postBookmarksHandler(request("POST"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Could not save bookmarks. Please try again.",
    });
    mock.getUserBookmarks.mockRejectedValue(new Error("private connection error"));
    const read = await getBookmarksHandler(request("GET", undefined, {}));
    expect(read.status).toBe(500);
    expect(await read.json()).toEqual({
      status: "error",
      error: "Could not load bookmarks. Please try again.",
    });
  });
});
