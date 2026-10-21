import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpotifyDeferredError } from "@/lib/spotify/SpotifyDeferredError";

const { fetchSpotifyResponse } = vi.hoisted(() => ({ fetchSpotifyResponse: vi.fn() }));
vi.mock("@/lib/spotify/fetchSpotifyResponse", () => ({ fetchSpotifyResponse }));
const { fetchWithoutAcceptLanguage } = await import("@/lib/networking/fetchWithoutAcceptLanguage");
const { getSpotifyArtistData } = await import("@/lib/spotifyData/getSpotifyArtistData");

const headers = { headers: { Authorization: "Bearer t" } };
const json = (body: unknown, status = 200) => ({
  ok: status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  fetchSpotifyResponse.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getSpotifyArtistData", () => {
  it("returns Spotify's artist as is, with images, genres and followers defaulted", async () => {
    fetchSpotifyResponse.mockResolvedValueOnce(json({ id: "sp1", name: "A", href: "h", uri: "u" }));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: null,
      data: {
        id: "sp1",
        name: "A",
        href: "h",
        uri: "u",
        images: [],
        genres: [],
        followers: { total: 0 },
      },
    });
    expect(fetchSpotifyResponse).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/artists/sp1",
      expect.objectContaining({ headers: headers.headers }),
      fetchWithoutAcceptLanguage, // MusicNerdWeb's href carries no ?locale=*
    );
  });

  it("names each failure the way MusicNerdWeb did", async () => {
    expect(await getSpotifyArtistData("sp1", { headers: { Authorization: "" } })).toEqual({
      error: "Spotify authentication failed",
      data: null,
    });
    fetchSpotifyResponse.mockResolvedValueOnce(json({ error: { status: 404 } }, 404));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Invalid Spotify ID",
      data: null,
    });
    fetchSpotifyResponse.mockResolvedValueOnce(
      json({ error: { status: 400, message: "invalid id" } }, 400),
    );
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Invalid Spotify ID",
      data: null,
    });
    fetchSpotifyResponse.mockResolvedValueOnce(json({}, 401));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Spotify authentication failed",
      data: null,
    });
    fetchSpotifyResponse.mockRejectedValueOnce(new SpotifyDeferredError(Date.now() + 1000, true));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Rate limit exceeded, please try again later",
      data: null,
    });
    fetchSpotifyResponse.mockResolvedValueOnce(json({}, 500));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Failed to fetch artist data from Spotify",
      data: null,
    });
    fetchSpotifyResponse.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Network error while fetching artist data",
      data: null,
    });
    fetchSpotifyResponse.mockResolvedValueOnce(json(null));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "No data returned from Spotify",
      data: null,
    });
    fetchSpotifyResponse.mockResolvedValueOnce(json({ id: "sp1" }));
    expect(await getSpotifyArtistData("sp1", headers)).toEqual({
      error: "Invalid artist data format from Spotify",
      data: null,
    });
  });
});
