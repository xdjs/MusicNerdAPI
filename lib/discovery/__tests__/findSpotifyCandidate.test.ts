import { describe, it, expect, vi, beforeEach } from "vitest";

const { spotifyArtistFromDeezer, searchSpotifyArtists } = vi.hoisted(() => ({
  spotifyArtistFromDeezer: vi.fn(),
  searchSpotifyArtists: vi.fn(),
}));
vi.mock("@/lib/musicPlatform/spotifyArtistFromDeezer", () => ({ spotifyArtistFromDeezer }));
vi.mock("@/lib/musicPlatform/searchSpotifyArtists", () => ({ searchSpotifyArtists }));
const { findSpotifyCandidate } = await import("@/lib/discovery/findSpotifyCandidate");

beforeEach(() => {
  spotifyArtistFromDeezer.mockReset().mockResolvedValue(null);
  searchSpotifyArtists.mockReset().mockResolvedValue([]);
});

describe("findSpotifyCandidate", () => {
  it("resolves Spotify from the Deezer id by ISRC before searching by name", async () => {
    spotifyArtistFromDeezer.mockResolvedValueOnce({
      spotifyId: "FROM_ISRC",
      recordings: 3,
      byName: false,
    });
    expect(await findSpotifyCandidate("Pete Rango", { deezer: "94933462" })).toEqual({
      tier: 2,
      platform: "spotify",
      url: "https://open.spotify.com/artist/FROM_ISRC",
      reasoning: "Shares 3 recordings (by ISRC) with their Deezer catalogue",
    });
    expect(spotifyArtistFromDeezer).toHaveBeenCalledWith("94933462", "Pete Rango");
    expect(searchSpotifyArtists).not.toHaveBeenCalled();
  });

  it("says when the name broke the tie, singular", async () => {
    spotifyArtistFromDeezer.mockResolvedValueOnce({ spotifyId: "X", recordings: 1, byName: true });
    expect((await findSpotifyCandidate("Pete Rango", { deezer: "1" }))?.reasoning).toBe(
      "Shares 1 recording (by ISRC) with their Deezer catalogue, name confirmed among the performers",
    );
  });

  it("falls back to an exact-name search, and proposes nothing without one", async () => {
    searchSpotifyArtists.mockResolvedValueOnce([
      {
        platform: "spotify",
        platformId: "b",
        name: "Pete Rango",
        followerCount: 652,
        profileUrl: "https://open.spotify.com/artist/BY_NAME",
      },
    ]);
    expect(await findSpotifyCandidate("Pete Rango", {})).toMatchObject({
      url: "https://open.spotify.com/artist/BY_NAME",
      reasoning: "Exact name match via Spotify search (652 followers)",
    });
    expect(spotifyArtistFromDeezer).not.toHaveBeenCalled();
    expect(await findSpotifyCandidate("Pete Rango", {})).toBeNull();
  });

  it("never throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    searchSpotifyArtists.mockRejectedValueOnce(new Error("x"));
    expect(await findSpotifyCandidate("Pete Rango", {})).toBeNull();
    error.mockRestore();
  });
});
