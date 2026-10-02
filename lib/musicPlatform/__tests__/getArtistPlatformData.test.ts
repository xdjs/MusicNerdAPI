import { describe, it, expect, vi, beforeEach } from "vitest";

const { getDeezerArtist, getSpotifyArtist } = vi.hoisted(() => ({
  getDeezerArtist: vi.fn(),
  getSpotifyArtist: vi.fn(),
}));
vi.mock("@/lib/musicPlatform/getDeezerArtist", () => ({ getDeezerArtist }));
vi.mock("@/lib/musicPlatform/getSpotifyArtist", () => ({ getSpotifyArtist }));
const { getArtistPlatformData } = await import("@/lib/musicPlatform/getArtistPlatformData");

const deezer = { platform: "deezer", platformId: "5" };
const spotify = { platform: "spotify", platformId: "sp" };

beforeEach(() => {
  getDeezerArtist.mockReset();
  getSpotifyArtist.mockReset();
});

describe("getArtistPlatformData", () => {
  it("uses Deezer first when the artist has it", async () => {
    getDeezerArtist.mockResolvedValueOnce(deezer);
    expect(await getArtistPlatformData({ deezer: "5", spotify: "sp" })).toBe(deezer);
    expect(getDeezerArtist).toHaveBeenCalledWith("5");
    expect(getSpotifyArtist).not.toHaveBeenCalled();
  });

  it("falls back to Spotify when Deezer is null or throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getDeezerArtist.mockResolvedValueOnce(null);
    getSpotifyArtist.mockResolvedValueOnce(spotify);
    expect(await getArtistPlatformData({ deezer: "5", spotify: "sp" })).toBe(spotify);
    getDeezerArtist.mockRejectedValueOnce(new Error("down"));
    getSpotifyArtist.mockResolvedValueOnce(spotify);
    expect(await getArtistPlatformData({ deezer: "5", spotify: "sp" })).toBe(spotify);
    error.mockRestore();
  });

  it("uses Spotify alone, treating blank ids as missing, and is null with neither", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getSpotifyArtist.mockResolvedValueOnce(spotify);
    expect(await getArtistPlatformData({ deezer: "  ", spotify: " sp " })).toBe(spotify);
    expect(getSpotifyArtist).toHaveBeenCalledWith("sp");
    expect(getDeezerArtist).not.toHaveBeenCalled();
    expect(await getArtistPlatformData({ deezer: null, spotify: null })).toBeNull();
    getSpotifyArtist.mockRejectedValueOnce(new Error("down"));
    expect(await getArtistPlatformData({ spotify: "sp" })).toBeNull();
    error.mockRestore();
  });
});
