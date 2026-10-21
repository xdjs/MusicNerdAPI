import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchSpotifyResponse } = vi.hoisted(() => ({ fetchSpotifyResponse: vi.fn() }));
vi.mock("@/lib/spotify/fetchSpotifyResponse", () => ({ fetchSpotifyResponse }));
const { getSpotifyArtistImage } = await import("@/lib/musicPlatform/getSpotifyArtistImage");

const headers = { headers: { Authorization: "Bearer t" } };
const json = (body: unknown, ok = true) => ({ ok, json: async () => body });

beforeEach(() => {
  vi.unstubAllGlobals();
  fetchSpotifyResponse.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getSpotifyArtistImage", () => {
  it("returns the first Web API image", async () => {
    fetchSpotifyResponse.mockResolvedValueOnce(json({ images: [{ url: "https://i.scdn.co/a" }] }));
    expect(await getSpotifyArtistImage("sp1", headers)).toBe("https://i.scdn.co/a");
    expect(fetchSpotifyResponse).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/artists/sp1",
      expect.objectContaining({ headers: headers.headers }),
    );
  });

  it("falls back to the oEmbed thumbnail when the Web API has none or fails, or without headers", async () => {
    const oembed = vi.fn(async () => json({ thumbnail_url: "https://i.scdn.co/thumb" }));
    vi.stubGlobal("fetch", oembed);
    fetchSpotifyResponse.mockResolvedValueOnce(json({ images: [] }));
    expect(await getSpotifyArtistImage("sp1", headers)).toBe("https://i.scdn.co/thumb");
    expect(oembed).toHaveBeenCalledWith(
      "https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Fartist%2Fsp1",
      expect.anything(),
    );
    fetchSpotifyResponse.mockRejectedValueOnce(new Error("down"));
    expect(await getSpotifyArtistImage("sp1", headers)).toBe("https://i.scdn.co/thumb");
    expect(await getSpotifyArtistImage("sp1", null)).toBe("https://i.scdn.co/thumb");
    expect(fetchSpotifyResponse).toHaveBeenCalledTimes(2);
  });

  it("refuses an oEmbed thumbnail that is not on Spotify's CDN, and is null when oEmbed fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ thumbnail_url: "https://evil.example/x" })),
    );
    expect(await getSpotifyArtistImage("sp1", null)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({}, false)),
    );
    expect(await getSpotifyArtistImage("sp1", null)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    expect(await getSpotifyArtistImage("sp1", null)).toBeNull();
  });
});
