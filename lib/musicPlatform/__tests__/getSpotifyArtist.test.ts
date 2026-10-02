import { describe, it, expect, vi, beforeEach } from "vitest";

const { readSpotifyJson, getSpotifyHeaders } = vi.hoisted(() => ({
  readSpotifyJson: vi.fn(),
  getSpotifyHeaders: vi.fn(),
}));
vi.mock("@/lib/spotify/readSpotifyJson", () => ({ readSpotifyJson }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
const { getSpotifyArtist } = await import("@/lib/musicPlatform/getSpotifyArtist");

const ARTIST = {
  id: "sp1",
  name: "Pete Rango",
  images: [{ url: "https://i/1.jpg" }],
  followers: { total: 42 },
  genres: ["soul"],
  external_urls: { spotify: "https://open.spotify.com/artist/sp1" },
};
const H = { headers: { Authorization: "Bearer t" } };

beforeEach(() => {
  readSpotifyJson.mockReset();
  getSpotifyHeaders.mockReset().mockResolvedValue(H);
});

function route(map: Record<string, unknown>) {
  readSpotifyJson.mockImplementation(async (url: string) => {
    for (const [k, v] of Object.entries(map))
      if (url.includes(k)) {
        if (v instanceof Error) throw v;
        return v;
      }
    throw new Error("unrouted " + url);
  });
}

describe("getSpotifyArtist", () => {
  it("reads the artist, release count and top track", async () => {
    route({
      "/albums": { total: 12 },
      "/top-tracks": { tracks: [{ name: "Hit" }] },
      "/artists/sp1": ARTIST,
    });
    const a = await getSpotifyArtist("sp1");
    expect(a).toMatchObject({
      platform: "spotify",
      platformId: "sp1",
      albumCount: 12,
      topTrackName: "Hit",
    });
    expect(readSpotifyJson).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/artists/sp1/albums?include_groups=album%2Csingle",
      H,
    );
    expect(readSpotifyJson).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/artists/sp1/top-tracks",
      H,
    );
  });

  it("is null when the artist can't be read or lacks a name", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    route({ "/artists/sp1": new Error("Spotify returned 404") });
    expect(await getSpotifyArtist("sp1")).toBeNull();
    route({
      "/albums": { total: 1 },
      "/top-tracks": { tracks: [] },
      "/artists/sp1": { id: "sp1" },
    });
    expect(await getSpotifyArtist("sp1")).toBeNull();
    error.mockRestore();
  });

  it("defaults the album count and top track when those calls fail", async () => {
    route({
      "/albums": new Error("429"),
      "/top-tracks": new Error("429"),
      "/artists/sp1": { ...ARTIST, images: undefined, genres: undefined, followers: undefined },
    });
    expect(await getSpotifyArtist("sp1")).toMatchObject({
      albumCount: 0,
      topTrackName: null,
      imageUrl: null,
      genres: [],
      followerCount: 0,
    });
  });
});
