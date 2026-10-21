import { beforeEach, describe, expect, it, vi } from "vitest";

const { find, image, getSpotifyHeaders } = vi.hoisted(() => ({
  find: vi.fn(),
  image: vi.fn(),
  getSpotifyHeaders: vi.fn(),
}));
vi.mock("@/lib/artistLookups/findArtistByColumn", () => ({ findArtistByColumn: find }));
vi.mock("@/lib/musicPlatform/getArtistImage", () => ({ getArtistImage: image }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
const { getArtistImageRedirectHandler } =
  await import("@/lib/artistImage/getArtistImageRedirectHandler");
const { lookupArtists } = await import("@/lib/artistLookups/lookupArtists");

const id = "6cb3d81a-3d02-4c57-a711-bb7902a9af1b";
const headers = { headers: { Authorization: "Bearer t" } };
const get = (artistId = id) =>
  getArtistImageRedirectHandler(new Request(`https://test/api/artist/${artistId}/image`), artistId);

beforeEach(() => {
  find.mockReset().mockResolvedValue({ id, customImage: null, spotify: "sp", deezer: null });
  image.mockReset().mockResolvedValue("https://cdn.example.com/photo.jpg");
  getSpotifyHeaders.mockReset().mockResolvedValue(headers);
});

describe("getArtistImageRedirectHandler", () => {
  it("redirects to the provider portrait for artists without uploads, cacheable for an hour", async () => {
    const r = await get();
    expect(r.status).toBe(307);
    expect(r.headers.get("Location")).toBe("https://cdn.example.com/photo.jpg");
    expect(r.headers.get("Cache-Control")).toContain("max-age=3600");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(find).toHaveBeenCalledWith(lookupArtists.id, id);
    expect(image).toHaveBeenCalledWith({ spotify: "sp", deezer: null, customImage: null }, headers);
  });

  it("goes on without a Spotify token when none can be fetched, and skips it without a Spotify id", async () => {
    getSpotifyHeaders.mockRejectedValueOnce(new Error("no creds"));
    expect((await get()).status).toBe(307);
    expect(image).toHaveBeenLastCalledWith(
      { spotify: "sp", deezer: null, customImage: null },
      null,
    );
    find.mockResolvedValueOnce({ id, customImage: null, spotify: null, deezer: "5" });
    await get();
    expect(getSpotifyHeaders).toHaveBeenCalledTimes(1);
  });

  it("prefers a custom upload, relative paths resolved against the request, and avoids provider work", async () => {
    find.mockResolvedValueOnce({ id, customImage: " /artist-photo.png " });
    const r = await get();
    expect(r.headers.get("Location")).toBe("https://test/artist-photo.png");
    expect(image).not.toHaveBeenCalled();
  });

  it("rejects invalid ids before reading the database", async () => {
    const r = await get("bad");
    expect(r.status).toBe(400);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(find).not.toHaveBeenCalled();
  });

  it("answers 404 for missing artists or photos", async () => {
    find.mockResolvedValueOnce(undefined);
    expect((await get()).status).toBe(404);
    image.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(404);
  });

  it("does not cache failures or redirect to unsafe schemes", async () => {
    image.mockResolvedValueOnce("javascript:alert(1)");
    const r = await get();
    expect(r.status).toBe(404);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    find.mockRejectedValueOnce(new Error("unavailable"));
    expect((await get()).status).toBe(503);
  });

  it("logs the error behind an empty 503, which keeps CORS and no-store", async () => {
    const error = new Error("database unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    find.mockRejectedValueOnce(error);
    const r = await get();
    expect(r.status).toBe(503);
    expect(await r.text()).toBe("");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(log).toHaveBeenCalledWith("[artist image]", id, error);
    log.mockRestore();
  });

  it("ignores stored placeholder images when a provider portrait exists", async () => {
    for (const customImage of ["/default_pfp_pink.png", "/musicNerdLogo.png", "/placeholder.png"]) {
      find.mockResolvedValueOnce({ id, customImage });
      expect((await get()).headers.get("Location")).toBe("https://cdn.example.com/photo.jpg");
    }
  });

  it("falls back to providers when legacy custom URLs are invalid", async () => {
    for (const customImage of [
      "garbage",
      "//example.com/photo.jpg",
      "javascript:alert(1)",
      "http://cdn.example.com/photo.jpg",
      "https://[broken",
      "https://user:password@example.com/photo.jpg",
    ]) {
      find.mockResolvedValueOnce({ id, customImage });
      const r = await get();
      expect(r.status).toBe(307);
      expect(r.headers.get("Location")).toBe("https://cdn.example.com/photo.jpg");
    }
  });
});
