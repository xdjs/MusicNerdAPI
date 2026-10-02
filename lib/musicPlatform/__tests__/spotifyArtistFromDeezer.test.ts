import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getSpotifyHeaders } = vi.hoisted(() => ({ getSpotifyHeaders: vi.fn() }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders }));
const { spotifyArtistFromDeezer } = await import("@/lib/musicPlatform/spotifyArtistFromDeezer");

/** Stands in for Deezer + Spotify: `tracks` maps a Deezer track id to its ISRC,
 *  `isrcs` maps an ISRC to the artists Spotify credits on it. */
function stubApis({
  top = [] as number[],
  tracks = {} as Record<string, string>,
  isrcs = {} as Record<string, { id: string; name: string }[]>,
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const ok = (body: unknown) => ({ ok: true, json: async () => body });
      if (url.includes("/top?")) return ok({ data: top.map(id => ({ id })) });
      const t = url.match(/api\.deezer\.com\/track\/(\d+)/);
      if (t) return ok(tracks[t[1]] ? { isrc: tracks[t[1]] } : {});
      const s = url.match(/isrc%3A([A-Z0-9]+)/i);
      if (s) {
        const artists = isrcs[s[1]];
        return ok({ tracks: { items: artists ? [{ artists }] : [] } });
      }
      return { ok: false, json: async () => ({}) };
    }),
  );
}

beforeEach(() => {
  getSpotifyHeaders.mockReset().mockResolvedValue({ headers: { Authorization: "Bearer test" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("spotifyArtistFromDeezer", () => {
  it("does not take the first artist on the track: that is often a collaborator", async () => {
    stubApis({
      top: [1],
      tracks: { 1: "CA5KR2659261" },
      isrcs: {
        CA5KR2659261: [
          { id: "dame-atlas", name: "Dame Atlas" },
          { id: "pete", name: "Pete Rango" },
        ],
      },
    });
    expect(await spotifyArtistFromDeezer("94933462", "Pete Rango")).toEqual({
      spotifyId: "pete",
      recordings: 1,
      byName: true,
    });
  });

  it("lets the recordings decide when they can, without needing the name", async () => {
    stubApis({
      top: [1, 2, 3],
      tracks: { 1: "AAA", 2: "BBB", 3: "CCC" },
      isrcs: {
        AAA: [
          { id: "them", name: "Black Dave MK2" },
          { id: "guest", name: "A Guest" },
        ],
        BBB: [{ id: "them", name: "Black Dave MK2" }],
        CCC: [{ id: "them", name: "Black Dave MK2" }],
      },
    });
    expect(await spotifyArtistFromDeezer("1", "totally different name")).toEqual({
      spotifyId: "them",
      recordings: 3,
      byName: false,
    });
  });

  it("will not accept a lone recording by a lone artist without checking the name", async () => {
    stubApis({
      top: [1],
      tracks: { 1: "AAA" },
      isrcs: { AAA: [{ id: "someone-else", name: "Somebody Entirely Different" }] },
    });
    expect(await spotifyArtistFromDeezer("1", "Pete Rango")).toBeNull();
  });

  it("accepts a lone recording when its lone artist IS the artist", async () => {
    stubApis({
      top: [1],
      tracks: { 1: "AAA" },
      isrcs: { AAA: [{ id: "them", name: "Pete Rango" }] },
    });
    expect(await spotifyArtistFromDeezer("1", "Pete Rango")).toEqual({
      spotifyId: "them",
      recordings: 1,
      byName: true,
    });
  });

  it("abstains when tied collaborators include nobody with the artist name", async () => {
    stubApis({
      top: [1],
      tracks: { 1: "AAA" },
      isrcs: {
        AAA: [
          { id: "a", name: "One Person" },
          { id: "b", name: "Another Person" },
        ],
      },
    });
    expect(await spotifyArtistFromDeezer("1", "Pete Rango")).toBeNull();
  });

  it("returns null when Deezer exposes no ISRCs or Spotify knows none of them", async () => {
    stubApis({ top: [1], tracks: {} });
    expect(await spotifyArtistFromDeezer("1", "Pete Rango")).toBeNull();
    stubApis({ top: [1], tracks: { 1: "AAA" }, isrcs: {} });
    expect(await spotifyArtistFromDeezer("1", "Pete Rango")).toBeNull();
  });

  it("never throws when the APIs or the token do", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(spotifyArtistFromDeezer("1", "Pete Rango")).resolves.toBeNull();
    stubApis({ top: [1], tracks: { 1: "AAA" } });
    getSpotifyHeaders.mockRejectedValueOnce(new Error("no creds"));
    await expect(spotifyArtistFromDeezer("1", "Pete Rango")).resolves.toBeNull();
    error.mockRestore();
  });
});
