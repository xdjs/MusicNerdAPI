import { beforeEach, expect, it, vi } from "vitest";
import { resolveCatalogCounterpart } from "@/lib/musicPlatform/resolveCatalogCounterpart";
const m = vi.hoisted(() => ({
  headers: vi.fn(),
  isrcs: vi.fn(),
  read: vi.fn(),
  search: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders: m.headers }));
vi.mock("@/lib/musicPlatform/isrcsFromDeezer", () => ({ isrcsFromDeezer: m.isrcs }));
vi.mock("@/lib/spotifyMatch/readSpotifyRecordingMatch", () => ({
  readSpotifyRecordingMatch: m.read,
}));
vi.mock("@/lib/musicPlatform/searchDeezerArtists", () => ({ searchDeezerArtists: m.search }));
const spotifyId = "3DmaZbBPnKSGnxYRpHobss";
beforeEach(() => {
  vi.resetAllMocks();
  m.headers.mockResolvedValue({ headers: { Authorization: "Bearer fixture" } });
  m.isrcs.mockResolvedValue(["USAAA0000001", "USAAA0000002"]);
  m.read.mockImplementation(async (isrc: string) => ({
    isrc,
    artists: [{ id: spotifyId, name: "Pete Rango" }],
  }));
  m.search.mockResolvedValue([{ platformId: "94933462", name: "Pete Rango" }]);
});
it("resolves Deezer to Spotify with independent recordings", async () => {
  expect(
    await resolveCatalogCounterpart({ deezerId: "94933462", artistName: "Pete Rango" }),
  ).toMatchObject({ status: "verified", spotifyId, deezerId: "94933462" });
});
it("resolves Spotify to Deezer only after corroborating the exact Spotify identity", async () => {
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toMatchObject({
    status: "verified",
    spotifyId,
    deezerId: "94933462",
  });
  expect(m.headers).toHaveBeenCalledTimes(1);
  m.read.mockImplementation(async (isrc: string) => ({
    isrc,
    artists: [{ id: "X".repeat(22), name: "Pete Rango" }],
  }));
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "not_found",
  });
});
it("does not confuse unavailable provider data with no catalog match", async () => {
  m.read.mockRejectedValue(new Error("429"));
  expect(
    await resolveCatalogCounterpart({ deezerId: "94933462", artistName: "Pete Rango" }),
  ).toEqual({ status: "provider_failure" });
  m.isrcs.mockResolvedValue([]);
  expect(
    await resolveCatalogCounterpart({ deezerId: "94933462", artistName: "Pete Rango" }),
  ).toEqual({ status: "not_found" });
});
it("requires two distinct recordings and declines collaborator ties", async () => {
  m.isrcs.mockResolvedValue(["USAAA0000001"]);
  expect(
    await resolveCatalogCounterpart({ deezerId: "94933462", artistName: "Pete Rango" }),
  ).toEqual({ status: "ambiguous" });
  m.isrcs.mockResolvedValue(["USAAA0000001", "USAAA0000002"]);
  m.read.mockImplementation(async (isrc: string) => ({
    isrc,
    artists: [
      { id: spotifyId, name: "Pete Rango" },
      { id: "X".repeat(22), name: "Dame Atlas" },
    ],
  }));
  expect(
    await resolveCatalogCounterpart({ deezerId: "94933462", artistName: "Pete Rango" }),
  ).toEqual({ status: "ambiguous" });
});
it("declines multiple matching Deezer identities and bounded/incomplete searches", async () => {
  m.search.mockResolvedValue([{ platformId: "1" }, { platformId: "2" }]);
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "ambiguous",
  });
  m.search.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ platformId: String(i + 1) })));
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "ambiguous",
  });
});
