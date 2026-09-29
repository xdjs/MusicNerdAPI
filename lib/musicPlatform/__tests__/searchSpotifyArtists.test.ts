import { describe, it, expect, vi, beforeEach } from "vitest";

const { readSpotifyJson, getSpotifyHeaders } = vi.hoisted(() => ({
  readSpotifyJson: vi.fn(),
  getSpotifyHeaders: vi.fn(),
}));
vi.mock("@/lib/spotify/readSpotifyJson", () => ({ readSpotifyJson }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
const { searchSpotifyArtists } = await import("@/lib/musicPlatform/searchSpotifyArtists");

beforeEach(() => {
  readSpotifyJson.mockReset();
  getSpotifyHeaders.mockReset().mockResolvedValue({ headers: { Authorization: "Bearer t" } });
});

describe("searchSpotifyArtists", () => {
  it("searches artists by name with the limit and maps the results", async () => {
    readSpotifyJson.mockResolvedValueOnce({
      artists: {
        items: [
          {
            id: "a",
            name: "Pete Rango",
            images: [],
            followers: { total: 5 },
            genres: [],
            external_urls: { spotify: "https://open.spotify.com/artist/a" },
          },
        ],
      },
    });
    const out = await searchSpotifyArtists("Pete Rango", 5);
    expect(readSpotifyJson.mock.calls[0][0]).toBe(
      "https://api.spotify.com/v1/search?q=Pete%20Rango&type=artist&limit=5",
    );
    expect(out).toEqual([
      expect.objectContaining({
        platformId: "a",
        name: "Pete Rango",
        followerCount: 5,
        albumCount: 0,
        topTrackName: null,
      }),
    ]);
  });

  it("is empty on any error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    readSpotifyJson.mockRejectedValueOnce(new Error("Spotify returned 500"));
    expect(await searchSpotifyArtists("x", 5)).toEqual([]);
    getSpotifyHeaders.mockRejectedValueOnce(new Error("Spotify credentials not configured"));
    expect(await searchSpotifyArtists("x", 5)).toEqual([]);
    error.mockRestore();
  });
});
