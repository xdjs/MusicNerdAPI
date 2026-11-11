import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProviderSearchArtist } from "@/lib/artistSearch/fetchProviderSearchArtist";
const { spotify, headers } = vi.hoisted(() => ({ spotify: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/spotify/fetchSpotifyResponse", () => ({ fetchSpotifyResponse: spotify }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders: headers }));
const fetcher = vi.fn();
const id = "7DRT8Nq9pZ9HuwZTSS7L8v";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetcher);
  headers.mockResolvedValue({ headers: { Authorization: "fixture" } });
});
afterEach(() => vi.unstubAllGlobals());
describe("fetchProviderSearchArtist", () => {
  it("uses fixed Spotify API and shared cooldown transport", async () => {
    spotify.mockResolvedValue(
      Response.json({ id, name: "Artist", images: [{ url: "https://cdn.test/a" }] }),
    );
    expect(await fetchProviderSearchArtist("spotify", id)).toMatchObject({
      id: null,
      platform: "spotify",
      platformId: id,
      name: "Artist",
      profileUrl: `https://open.spotify.com/artist/${id}`,
      isExternalOnly: true,
    });
    expect(spotify).toHaveBeenCalledWith(
      `https://api.spotify.com/v1/artists/${id}`,
      expect.objectContaining({ redirect: "error", headers: { Authorization: "fixture" } }),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses the fixed Deezer API", async () => {
    fetcher.mockResolvedValue(
      Response.json({ id: 1975, name: "Artist", picture_medium: "https://cdn.test/a" }),
    );
    expect(await fetchProviderSearchArtist("deezer", "1975")).toMatchObject({
      platform: "deezer",
      platformId: "1975",
      name: "Artist",
      isExternalOnly: true,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.deezer.com/artist/1975",
      expect.objectContaining({
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(spotify).not.toHaveBeenCalled();
  });
  it.each(["spotify", "deezer"] as const)("accepts confirmed HTTP 404 for %s", async platform => {
    (platform === "spotify" ? spotify : fetcher).mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    expect(
      await fetchProviderSearchArtist(platform, platform === "spotify" ? id : "1975"),
    ).toBeNull();
  });
  it("accepts Deezer code 800 as missing", async () => {
    fetcher.mockResolvedValue(Response.json({ error: { code: 800 } }));
    expect(await fetchProviderSearchArtist("deezer", "1975")).toBeNull();
  });
  it.each([401, 403, 429, 500, 503])("does not turn HTTP %s into absence", async status => {
    fetcher.mockResolvedValue(new Response(null, { status }));
    await expect(fetchProviderSearchArtist("deezer", "1975")).rejects.toThrow("unavailable");
  });
  it.each([
    { id: 1976, name: "Wrong" },
    { id: 1975 },
    { id: 1975, name: "" },
    { error: { code: 4 } },
    null,
  ])("rejects malformed or mismatched payload %j", async payload => {
    fetcher.mockResolvedValue(Response.json(payload));
    await expect(fetchProviderSearchArtist("deezer", "1975")).rejects.toThrow("unavailable");
  });
  it("propagates shared Spotify cooldown as unavailable", async () => {
    headers.mockRejectedValue(new Error("cooldown"));
    await expect(fetchProviderSearchArtist("spotify", id)).rejects.toThrow("unavailable");
    expect(spotify).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and network failures", async () => {
    fetcher.mockResolvedValueOnce(new Response("not json"));
    await expect(fetchProviderSearchArtist("deezer", "1975")).rejects.toThrow("unavailable");
    fetcher.mockRejectedValueOnce(new Error("network"));
    await expect(fetchProviderSearchArtist("deezer", "1975")).rejects.toThrow("unavailable");
  });
});
