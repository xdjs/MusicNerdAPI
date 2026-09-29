import { describe, it, expect, vi, beforeEach } from "vitest";

const { mb } = vi.hoisted(() => ({ mb: vi.fn() }));
vi.mock("@/lib/musicbrainz/mb", () => ({ mb }));
vi.mock("@/lib/musicbrainz/sinceLastCall", () => ({ sinceLastCall: async () => true }));
const { fetchMusicBrainzLinks } = await import("@/lib/musicbrainz/fetchMusicBrainzLinks");

const detail = (...rels: [string, string?][]) => ({
  relations: rels.map(([resource, type]) => ({
    type: type ?? "social network",
    url: { resource },
  })),
});

beforeEach(() => mb.mockReset());

describe("fetchMusicBrainzLinks", () => {
  it("matches by identifier when an entry links a Spotify id we hold", async () => {
    mb.mockResolvedValueOnce({ artists: [{ id: "m1", name: "Someone Else", score: 100 }] });
    mb.mockResolvedValueOnce(
      detail(
        ["https://open.spotify.com/artist/S1"],
        ["https://pete.com", "official homepage"],
        ["https://twitter.com/p"],
      ),
    );
    expect(await fetchMusicBrainzLinks("Pete Rango", { spotify: "S1" })).toEqual({
      matchedBy: "identifier",
      urls: ["https://open.spotify.com/artist/S1", "https://pete.com", "https://twitter.com/p"],
      homepage: "https://pete.com",
    });
    expect(mb.mock.calls[0][0]).toBe(
      `/artist?query=${encodeURIComponent('artist:"Pete Rango"')}&fmt=json&limit=5`,
    );
    expect(mb.mock.calls[1][0]).toBe("/artist/m1?inc=url-rels&fmt=json");
  });

  it("never treats an id that merely starts with ours as an identifier match", async () => {
    mb.mockResolvedValueOnce({ artists: [{ id: "m1", name: "Pete Rango", score: 100 }] });
    mb.mockResolvedValueOnce(detail(["https://www.deezer.com/artist/1234"]));
    expect((await fetchMusicBrainzLinks("Pete Rango", { deezer: "123" }))?.matchedBy).toBe(
      "exact-name",
    );
  });

  it("prefers a later identifier match over an earlier exact-name match", async () => {
    mb.mockResolvedValueOnce({
      artists: [
        { id: "m1", name: "Pete Rango", score: 100 },
        { id: "m2", name: "P. Rango", score: 95 },
      ],
    });
    mb.mockResolvedValueOnce(detail(["https://a.com"]));
    mb.mockResolvedValueOnce(detail(["https://www.deezer.com/artist/77"]));
    expect(await fetchMusicBrainzLinks("Pete Rango", { deezer: "77" })).toMatchObject({
      matchedBy: "identifier",
    });
  });

  it("abstains when several high-scoring entries share the exact name", async () => {
    mb.mockResolvedValueOnce({
      artists: [
        { id: "m1", name: "Black Dave", score: 100 },
        { id: "m2", name: "Black Dave", score: 100 },
      ],
    });
    mb.mockResolvedValue(detail(["https://a.com"]));
    expect(await fetchMusicBrainzLinks("Black Dave", {})).toBeNull();
  });

  it("ignores low scores, entries with no links, and an empty name", async () => {
    mb.mockResolvedValueOnce({ artists: [{ id: "m1", name: "Pete Rango", score: 80 }] });
    expect(await fetchMusicBrainzLinks("Pete Rango", {})).toBeNull();
    mb.mockResolvedValueOnce({ artists: [{ id: "m1", name: "Pete Rango", score: 100 }] });
    mb.mockResolvedValueOnce({ relations: [] });
    expect(await fetchMusicBrainzLinks("Pete Rango", {})).toBeNull();
    expect(await fetchMusicBrainzLinks("  ", {})).toBeNull();
  });

  it("is null when the search itself fails", async () => {
    mb.mockResolvedValueOnce(null);
    expect(await fetchMusicBrainzLinks("Pete Rango", {})).toBeNull();
  });
});
