import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { authenticateRequest, canEditArtist, findFirst, getProviderPhoto } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  canEditArtist: vi.fn(),
  findFirst: vi.fn(),
  getProviderPhoto: vi.fn(),
}));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest }));
vi.mock("@/lib/auth/canEditArtist", () => ({ canEditArtist }));
vi.mock("@/lib/db/db", () => ({ db: { query: { artists: { findFirst } } } }));
vi.mock("@/lib/artistImages/getProviderPhoto", () => ({ getProviderPhoto }));
const { getPhotoChoiceHandler } = await import("@/lib/artistImages/getPhotoChoiceHandler");

const ARTIST = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
const request = (artistId = ARTIST) =>
  new Request(`https://api.test/api/artist/photo-choice?artistId=${artistId}`);
const artist = { id: ARTIST, deezer: " 5590 ", spotify: null, customImage: "https://old/x.jpg" };

beforeEach(() => {
  authenticateRequest.mockReset().mockResolvedValue({ userId: "u1" });
  canEditArtist.mockReset().mockResolvedValue(true);
  findFirst.mockReset().mockResolvedValue(artist);
  getProviderPhoto.mockReset();
});

describe("getPhotoChoiceHandler", () => {
  it("returns one option per provider with the current photo to echo back", async () => {
    getProviderPhoto.mockImplementation(async (_a, source) =>
      source === "deezer" ? "https://cdn.deezer/xl.jpg" : null,
    );
    const response = await getPhotoChoiceHandler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      expectedCustomImage: "https://old/x.jpg",
      options: [
        { source: "deezer", providerId: "5590", imageUrl: "https://cdn.deezer/xl.jpg" },
        { source: "spotify", providerId: null, imageUrl: null },
      ],
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(canEditArtist).toHaveBeenCalledWith("u1", ARTIST);
  });

  it("answers 401 with no-store and CORS when not signed in", async () => {
    authenticateRequest.mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Not signed in" }, { status: 401 }),
    );
    const response = await getPhotoChoiceHandler(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ status: "error", error: "Not signed in" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("answers its JSON error (503, Web's status for this route) when signing in throws", async () => {
    authenticateRequest.mockRejectedValueOnce(new Error("db down"));
    const response = await getPhotoChoiceHandler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not load photo choices",
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers 400 for a bad artist id, before any authorization", async () => {
    const response = await getPhotoChoiceHandler(request("abc"));
    expect(response.status).toBe(400);
    expect(canEditArtist).not.toHaveBeenCalled();
  });

  it("answers 403 for someone who is neither claimant nor admin", async () => {
    canEditArtist.mockResolvedValueOnce(false);
    const response = await getPhotoChoiceHandler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Not authorized for this artist",
    });
  });

  it("answers 404 when the artist does not exist", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    const response = await getPhotoChoiceHandler(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "error", error: "Artist not found" });
  });

  it("answers 503 when the database cannot be read", async () => {
    findFirst.mockRejectedValueOnce(new Error("db down"));
    const response = await getPhotoChoiceHandler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Could not load photo choices",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
