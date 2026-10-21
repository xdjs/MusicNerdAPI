import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSpotifyJson } = vi.hoisted(() => ({ readSpotifyJson: vi.fn() }));
vi.mock("@/lib/spotify/readSpotifyJson", () => ({ readSpotifyJson }));
const { getSpotifyArtistsData } = await import("@/lib/spotifyData/getSpotifyArtistsData");
const { fetchWithoutAcceptLanguage } = await import("@/lib/networking/fetchWithoutAcceptLanguage");

const headers = { headers: { Authorization: "Bearer t" } };
beforeEach(() => readSpotifyJson.mockReset());

describe("getSpotifyArtistsData", () => {
  it("asks for the ids in one call and returns Spotify's list, nulls included", async () => {
    readSpotifyJson.mockResolvedValueOnce({ artists: [{ id: "a" }, null] });
    expect(await getSpotifyArtistsData(["a", "b"], headers)).toEqual([{ id: "a" }, null]);
    expect(readSpotifyJson).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/artists?ids=a,b",
      headers,
      fetchWithoutAcceptLanguage, // MusicNerdWeb's hrefs carry no ?locale=*
    );
  });

  it("splits more than 50 ids into chunks and concatenates", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id${i}`);
    readSpotifyJson
      .mockResolvedValueOnce({ artists: ids.slice(0, 50).map(id => ({ id })) })
      .mockResolvedValueOnce({ artists: [{ id: "id50" }] });
    expect((await getSpotifyArtistsData(ids, headers)).length).toBe(51);
    expect(readSpotifyJson).toHaveBeenCalledTimes(2);
  });

  it("throws when Spotify does", async () => {
    readSpotifyJson.mockRejectedValueOnce(new Error("Spotify returned 500"));
    await expect(getSpotifyArtistsData(["a"], headers)).rejects.toThrow("Spotify returned 500");
  });
});
