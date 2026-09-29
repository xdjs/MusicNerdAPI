import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSpotifyHeaders, getSpotifyCatalogNames } = vi.hoisted(() => ({
  getSpotifyHeaders: vi.fn(async () => ({ headers: { Authorization: "Bearer t" } })),
  getSpotifyCatalogNames: vi.fn(),
}));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
vi.mock("@/lib/spotify/getSpotifyCatalogNames", () => ({ getSpotifyCatalogNames }));
const { buildArtistAnchor } = await import("@/lib/vault/buildArtistAnchor");

beforeEach(() => {
  getSpotifyCatalogNames
    .mockReset()
    .mockResolvedValue({ releases: ["Miss Anthropocene"], topTracks: ["Oblivion"] });
});

describe("buildArtistAnchor", () => {
  it("gives the judge the real catalog, top tracks first, and the name-shaped identifiers", async () => {
    const anchor = await buildArtistAnchor(
      { spotify: "sp1", instagram: "grimes", discogs: "12345", facebookId: "999" },
      "Grimes",
    );
    expect(anchor).toEqual({
      name: "Grimes",
      catalog: ["Oblivion", "Miss Anthropocene"],
      identifiers: ["spotify: sp1", "instagram: grimes"],
    });
  });

  it("goes without a catalog when the artist has no Spotify or it fails", async () => {
    expect((await buildArtistAnchor({}, "Grimes")).catalog).toEqual([]);
    expect(getSpotifyCatalogNames).not.toHaveBeenCalled();
    getSpotifyHeaders.mockImplementationOnce(async () => {
      throw new Error("Spotify credentials not configured");
    });
    expect((await buildArtistAnchor({ spotify: "sp1" }, "Grimes")).catalog).toEqual([]);
  });
});
