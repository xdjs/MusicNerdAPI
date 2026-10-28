import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolveCatalogCounterpart, searchSpotifyArtists } = vi.hoisted(() => ({
  resolveCatalogCounterpart: vi.fn(),
  searchSpotifyArtists: vi.fn(),
}));
vi.mock("@/lib/musicPlatform/resolveCatalogCounterpart", () => ({ resolveCatalogCounterpart }));
vi.mock("@/lib/musicPlatform/searchSpotifyArtists", () => ({ searchSpotifyArtists }));
const { findSpotifyCandidate } = await import("@/lib/discovery/findSpotifyCandidate");

beforeEach(() => {
  resolveCatalogCounterpart.mockReset().mockResolvedValue({ status: "not_found" });
  searchSpotifyArtists.mockReset().mockResolvedValue([]);
});

describe("findSpotifyCandidate", () => {
  it("resolves Spotify from the Deezer id by ISRC before searching by name", async () => {
    resolveCatalogCounterpart.mockResolvedValueOnce({
      spotifyId: "FROM_ISRC",
      recordings: 3,
      status: "verified",
      deezerId: "94933462",
    });
    expect(await findSpotifyCandidate("Pete Rango", { deezer: "94933462" })).toEqual({
      tier: 2,
      platform: "spotify",
      url: "https://open.spotify.com/artist/FROM_ISRC",
      reasoning: "Verified across 3 distinct recordings (ISRC) and uncontested artist credits",
    });
    expect(resolveCatalogCounterpart).toHaveBeenCalledWith({
      deezerId: "94933462",
      artistName: "Pete Rango",
    });
    expect(searchSpotifyArtists).not.toHaveBeenCalled();
  });

  it("never falls back to name-only matching for an unresolved catalog counterpart", async () => {
    for (const status of ["ambiguous", "provider_failure", "not_found"]) {
      resolveCatalogCounterpart.mockResolvedValueOnce({ status });
      expect(await findSpotifyCandidate("Pete Rango", { deezer: "1" })).toBeNull();
    }
    expect(searchSpotifyArtists).not.toHaveBeenCalled();
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
    expect(resolveCatalogCounterpart).not.toHaveBeenCalled();
    expect(await findSpotifyCandidate("Pete Rango", {})).toBeNull();
  });

  it("never throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    searchSpotifyArtists.mockRejectedValueOnce(new Error("x"));
    expect(await findSpotifyCandidate("Pete Rango", {})).toBeNull();
    error.mockRestore();
  });
});
