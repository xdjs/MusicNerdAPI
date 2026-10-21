import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  deezer: vi.fn(),
  spotifyGet: vi.fn(),
  spotifyPost: vi.fn(),
  search: vi.fn(),
  batch: vi.fn(),
  tracks: vi.fn(),
  leaderboard: vi.fn(),
  image: vi.fn(),
}));
vi.mock("@/lib/artistLookups/findArtistByDeezerIdHandler", () => ({
  findArtistByDeezerIdHandler: h.deezer,
}));
vi.mock("@/lib/spotifyData/getSpotifyDataHandler", () => ({ getSpotifyDataHandler: h.spotifyGet }));
vi.mock("@/lib/spotifyData/postSpotifyDataHandler", () => ({
  postSpotifyDataHandler: h.spotifyPost,
}));
vi.mock("@/lib/artistSearch/postSearchArtistsHandler", () => ({
  postSearchArtistsHandler: h.search,
}));
vi.mock("@/lib/artistSearch/postSearchArtistsBatchHandler", () => ({
  postSearchArtistsBatchHandler: h.batch,
}));
vi.mock("@/lib/trackLinks/getTrackLinksHandler", () => ({ getTrackLinksHandler: h.tracks }));
vi.mock("@/lib/leaderboard/getLeaderboardHandler", () => ({
  getLeaderboardHandler: h.leaderboard,
}));
vi.mock("@/lib/artistImage/getArtistImageRedirectHandler", () => ({
  getArtistImageRedirectHandler: h.image,
}));

const deezer = await import("@/app/api/findArtistByDeezerID/route");
const spotify = await import("@/app/api/getSpotifyData/route");
const search = await import("@/app/api/searchArtists/route");
const batch = await import("@/app/api/searchArtists/batch/route");
const tracks = await import("@/app/api/trackLinks/route");
const leaderboard = await import("@/app/api/leaderboard/route");
const image = await import("@/app/api/artist/[id]/image/route");

const req = (method = "GET") => new Request("https://api.test/x", { method });

describe("external lookup routes", () => {
  it("answer the CORS preflight with 204, as MusicNerdWeb's getSpotifyData did", () => {
    for (const route of [deezer, spotify, search, batch, tracks, leaderboard, image]) {
      const res = route.OPTIONS();
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
  });

  it("hand each method to its handler", async () => {
    for (const fn of Object.values(h)) fn.mockResolvedValue(new Response("ok"));
    let r = req("POST");
    await deezer.POST(r);
    expect(h.deezer).toHaveBeenCalledWith(r);
    r = req();
    await spotify.GET(r);
    expect(h.spotifyGet).toHaveBeenCalledWith(r);
    r = req("POST");
    await spotify.POST(r);
    expect(h.spotifyPost).toHaveBeenCalledWith(r);
    r = req("POST");
    await search.POST(r);
    expect(h.search).toHaveBeenCalledWith(r);
    r = req("POST");
    await batch.POST(r);
    expect(h.batch).toHaveBeenCalledWith(r);
    r = req();
    await tracks.GET(r);
    expect(h.tracks).toHaveBeenCalledWith(r);
    r = req();
    await leaderboard.GET(r);
    expect(h.leaderboard).toHaveBeenCalledWith(r);
    r = req();
    await image.GET(r, { params: Promise.resolve({ id: "a1" }) });
    expect(h.image).toHaveBeenCalledWith(r, "a1");
  });

  it("the image route runs for up to 30 seconds and every route is dynamic", () => {
    expect(image.maxDuration).toBe(30);
    for (const route of [deezer, spotify, search, batch, tracks, leaderboard, image])
      expect(route.dynamic).toBe("force-dynamic");
  });
});
