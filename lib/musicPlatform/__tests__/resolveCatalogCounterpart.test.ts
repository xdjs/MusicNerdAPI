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
vi.mock("@/lib/musicPlatform/discoverDeezerCatalogCandidates", () => ({
  discoverDeezerCatalogCandidates: m.search,
}));
const spotifyId = "3DmaZbBPnKSGnxYRpHobss";
beforeEach(() => {
  vi.resetAllMocks();
  m.headers.mockResolvedValue({ headers: { Authorization: "Bearer fixture" } });
  m.isrcs.mockResolvedValue(["USAAA0000001", "USAAA0000002"]);
  m.read.mockImplementation(async (isrc: string) => ({
    isrc,
    artists: [{ id: spotifyId, name: "Pete Rango" }],
  }));
  m.search.mockResolvedValue({ status: "complete", ids: ["94933462"] });
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
  m.search.mockResolvedValue({ status: "complete", ids: ["1", "2"] });
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "ambiguous",
  });
  m.search.mockResolvedValue({ status: "incomplete_search" });
  m.isrcs.mockClear();
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "incomplete_search",
  });
  expect(m.isrcs).not.toHaveBeenCalled();
});
it("keeps provider reads sequential and stops immediately on rate limiting", async () => {
  let active = 0;
  let peak = 0;
  m.read.mockImplementation(async (isrc: string) => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    return { isrc, artists: [{ id: spotifyId, name: "Pete Rango" }] };
  });
  await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" });
  expect(peak).toBe(1);
  m.read.mockClear().mockRejectedValue(new Error("rate limited"));
  await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" });
  expect(m.read).toHaveBeenCalledTimes(1);
});

it("does not verify incomplete Spotify credits or unavailable candidate discovery", async () => {
  m.read.mockResolvedValue({
    isrc: "USAAA0000001",
    artists: [{ id: spotifyId, name: "Pete Rango" }],
    incomplete: true,
  });
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "ambiguous",
  });
  m.search.mockRejectedValue(new Error("Invalid provider response"));
  expect(await resolveCatalogCounterpart({ spotifyId, artistName: "Pete Rango" })).toEqual({
    status: "provider_failure",
  });
});
it("does not use candidate discovery for an explicit Deezer ID", async () => {
  m.search.mockRejectedValue(new Error("unavailable"));
  expect(
    await resolveCatalogCounterpart({ spotifyId, deezerId: "94933462", artistName: "Pete Rango" }),
  ).toMatchObject({ status: "verified" });
  expect(m.search).not.toHaveBeenCalled();
});
