import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getSpotifyHeaders,
  getSpotifyCatalogNames,
  fetchLatestProviderItems,
  getDiscogsGroupFacts,
} = vi.hoisted(() => ({
  getSpotifyHeaders: vi.fn(async () => ({ headers: { Authorization: "Bearer t" } })),
  getSpotifyCatalogNames: vi.fn(),
  fetchLatestProviderItems: vi.fn(),
  getDiscogsGroupFacts: vi.fn(),
}));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
vi.mock("@/lib/spotify/getSpotifyCatalogNames", () => ({ getSpotifyCatalogNames }));
vi.mock("@/lib/latestProviders/fetchLatestProviderItems", () => ({ fetchLatestProviderItems }));
vi.mock("@/lib/discogs/getDiscogsGroupFacts", () => ({ getDiscogsGroupFacts }));
const { buildArtistAnchor } = await import("@/lib/vault/buildArtistAnchor");

beforeEach(() => {
  fetchLatestProviderItems.mockReset().mockResolvedValue([]);
  getDiscogsGroupFacts.mockReset().mockResolvedValue([]);
  getSpotifyCatalogNames
    .mockReset()
    .mockResolvedValue({ releases: ["Miss Anthropocene"], topTracks: ["Oblivion"] });
});

describe("buildArtistAnchor", () => {
  it("uses the held Deezer catalog when Spotify is absent, with provider provenance", async () => {
    fetchLatestProviderItems.mockResolvedValue([
      {
        card: {
          title: "What Am I Here For (Piano Version)",
          sourceUrl: "https://www.deezer.com/album/431087527",
        },
      },
    ]);
    const a = await buildArtistAnchor({ deezer: "8699816" }, "Jamie Duffy");
    expect(a.catalog).toEqual(["What Am I Here For (Piano Version)"]);
    expect(a.catalogSources).toEqual([
      { title: a.catalog[0], url: "https://www.deezer.com/album/431087527" },
    ]);
    expect(fetchLatestProviderItems).toHaveBeenCalledWith("deezer", "8699816");
  });
  it("falls back on Spotify failure, but does not fetch another catalog after success", async () => {
    await buildArtistAnchor({ spotify: "sp1", deezer: "8699816" }, "Jamie Duffy");
    expect(fetchLatestProviderItems).not.toHaveBeenCalled();
    getSpotifyCatalogNames.mockRejectedValueOnce(new Error("unavailable"));
    await buildArtistAnchor({ spotify: "sp1", deezer: "8699816" }, "Jamie Duffy");
    expect(fetchLatestProviderItems).toHaveBeenCalledTimes(1);
  });
  it("gets group evidence only from the stored Discogs identity and tolerates catalog failure", async () => {
    fetchLatestProviderItems.mockRejectedValueOnce(new Error("offline"));
    getDiscogsGroupFacts.mockResolvedValue([
      { name: "Acumen Nation", sourceUrl: "https://api.discogs.com/artists/164081" },
    ]);
    const a = await buildArtistAnchor({ discogs: "164081", deezer: "8699816" }, "Jamie Duffy");
    expect(a.catalog).toEqual([]);
    expect(a.groups).toEqual([
      { name: "Acumen Nation", sourceUrl: "https://api.discogs.com/artists/164081" },
    ]);
    expect(getDiscogsGroupFacts).toHaveBeenCalledWith("164081", "Jamie Duffy");
  });
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
