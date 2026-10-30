import { beforeEach, expect, it, vi } from "vitest";
import snapshots from "./fixtures/deezer-catalog-2026-10-30.json";
import { discoverDeezerCatalogCandidates } from "../discoverDeezerCatalogCandidates";
import { resolveCatalogCounterpart } from "../resolveCatalogCounterpart";

// Public Deezer search/artist?q=<name>&limit=25, captured 2026-10-30.
// Recording evidence below is synthetic: these tests do not certify real artist pairs.
const m = vi.hoisted(() => ({ fetch: vi.fn(), isrcs: vi.fn(), read: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/networking/fetchJson", () => ({ fetchJson: m.fetch }));
vi.mock("@/lib/musicPlatform/isrcsFromDeezer", () => ({ isrcsFromDeezer: m.isrcs }));
vi.mock("@/lib/spotify/getSpotifyHeaders", () => ({ getSpotifyHeaders: m.headers }));
vi.mock("@/lib/spotifyMatch/readSpotifyRecordingMatch", () => ({
  readSpotifyRecordingMatch: m.read,
}));
const spotifyId = "A".repeat(22);
const candidates = [
  ["Pete Rango", ["94933462"]],
  ["Dame Atlas", ["362004652"]],
  ["DUTCHYYY", ["63751082"]],
  ["Sigur Rós", ["1417", "412348451"]],
  ["Radiohead", ["399", "12189436"]],
] as const;
const blocked = ["Aaron Doh", "LATASHA", "Björk", "Phoenix", "Common"];
function useSnapshot(name: string) {
  m.fetch.mockResolvedValue(snapshots.find(s => s.query === name)!.response);
}
beforeEach(() => {
  vi.resetAllMocks();
  m.headers.mockResolvedValue({ headers: { Authorization: "Bearer fixture" } });
});
for (const [name, ids] of candidates) {
  it(`${name}: keeps every normalized candidate in the complete captured response`, async () => {
    useSnapshot(name);
    expect(await discoverDeezerCatalogCandidates(name)).toEqual({ status: "complete", ids });
  });
  for (const mode of [
    "none",
    "one",
    "duplicate",
    "wrong_anchor",
    "incomplete",
    "verified",
  ] as const)
    it(`${name}: ${mode} recording evidence through real discovery and resolver`, async () => {
      useSnapshot(name);
      m.isrcs.mockImplementation(async (id: string) =>
        id !== ids[0] || mode === "none"
          ? []
          : mode === "one"
            ? ["USAAA0000001"]
            : mode === "duplicate"
              ? ["USAAA0000001", "USAAA0000001"]
              : ["USAAA0000001", "USAAA0000002"],
      );
      m.read.mockImplementation(async (isrc: string) => ({
        isrc,
        artists: [{ id: mode === "wrong_anchor" ? "B".repeat(22) : spotifyId, name }],
        incomplete: mode === "incomplete",
      }));
      const result = await resolveCatalogCounterpart({ artistName: name, spotifyId });
      expect(result.status).toBe(
        mode === "verified"
          ? "verified"
          : mode === "none" || mode === "wrong_anchor"
            ? "not_found"
            : "ambiguous",
      );
      if (mode === "verified")
        expect(result).toMatchObject({ spotifyId, deezerId: ids[0], recordings: 2 });
      expect(m.isrcs.mock.calls.map(call => call[0])).toEqual(ids);
    });
}
for (const name of blocked)
  it(`${name}: refuses the captured truncated search before recording calls`, async () => {
    useSnapshot(name);
    expect(await resolveCatalogCounterpart({ artistName: name, spotifyId })).toEqual({
      status: "incomplete_search",
    });
    expect(m.isrcs).not.toHaveBeenCalled();
    expect(m.headers).not.toHaveBeenCalled();
  });
for (const name of ["Sigur Rós", "Radiohead"])
  it(`${name}: two qualifying Deezer identities remain ambiguous`, async () => {
    useSnapshot(name);
    m.isrcs.mockResolvedValue(["USAAA0000001", "USAAA0000002"]);
    m.read.mockImplementation(async (isrc: string) => ({
      isrc,
      artists: [{ id: spotifyId, name }],
    }));
    expect(await resolveCatalogCounterpart({ artistName: name, spotifyId })).toEqual({
      status: "ambiguous",
    });
  });
for (const name of ["東京事変", "MusicNerdNoSuchArtist1649"])
  it(`${name}: unsupported normalized name or empty search cannot fabricate a match`, async () => {
    useSnapshot(name);
    expect(await resolveCatalogCounterpart({ artistName: name, spotifyId })).toEqual({
      status: "not_found",
    });
    expect(m.read).not.toHaveBeenCalled();
  });
