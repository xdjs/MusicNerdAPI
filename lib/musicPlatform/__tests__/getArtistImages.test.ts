import { beforeEach, describe, expect, it, vi } from "vitest";

const { image, getSpotifyHeaders } = vi.hoisted(() => ({
  image: vi.fn(),
  getSpotifyHeaders: vi.fn(),
}));
vi.mock("@/lib/musicPlatform/getArtistImage", () => ({ getArtistImage: image }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
const { getArtistImages } = await import("@/lib/musicPlatform/getArtistImages");

const headers = { headers: { Authorization: "Bearer t" } };

beforeEach(() => {
  image.mockReset();
  getSpotifyHeaders.mockReset();
});

describe("getArtistImages", () => {
  it("fetches one Spotify token for the whole batch and maps images by artist id", async () => {
    getSpotifyHeaders.mockResolvedValueOnce(headers);
    image.mockImplementation(async (a: { id: string }) => (a.id === "a" ? "img-a" : null));
    const artists = [
      { id: "a", spotify: "sp", deezer: null, customImage: null },
      { id: "b", spotify: null, deezer: "5", customImage: null },
    ];
    const map = await getArtistImages(artists);
    expect([...map.entries()]).toEqual([["a", "img-a"]]);
    expect(getSpotifyHeaders).toHaveBeenCalledTimes(1);
    expect(image).toHaveBeenCalledWith(artists[0], headers);
    expect(image).toHaveBeenCalledWith(artists[1], headers);
  });

  it("skips the token when no artist needs Spotify, and goes on without one when it fails", async () => {
    image.mockResolvedValue(null);
    await getArtistImages([{ id: "b", spotify: null, deezer: "5", customImage: null }]);
    expect(getSpotifyHeaders).not.toHaveBeenCalled();
    getSpotifyHeaders.mockRejectedValueOnce(new Error("no creds"));
    const artists = [{ id: "a", spotify: "sp", deezer: null, customImage: null }];
    expect(await getArtistImages(artists)).toEqual(new Map());
    expect(image).toHaveBeenCalledWith(artists[0], null);
  });

  it("is empty for no artists", async () => {
    expect(await getArtistImages([])).toEqual(new Map());
  });
});
