import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getArtistTotalsAndCoverage } from "@/lib/artistData/getArtistTotalsAndCoverage";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getArtistTotalsAndCoverage", () => {
  it("reads totals, one aliased count per tracked column, and readiness from one scan", async () => {
    mock.execute.mockResolvedValueOnce([
      {
        total_artists: 100,
        total_with_spotify: 80,
        col_instagram: 60,
        col_bio: 10,
        has_wikidata: 5,
        has_spotify_no_wikidata: 75,
        no_spotify: 20,
      },
    ]);
    const result = await getArtistTotalsAndCoverage();
    expect(result.totalArtists).toBe(100);
    expect(result.totalWithSpotify).toBe(80);
    expect(result.columnCounts.instagram).toBe(60);
    expect(result.columnCounts.bio).toBe(10);
    expect(result.columnCounts.patreon).toBe(0);
    expect(Object.keys(result.columnCounts)).toEqual(TRACKED_COLUMNS.map(c => c.column));
    expect(result.enrichment).toEqual({ hasWikidata: 5, hasSpotifyNoWikidata: 75, noSpotify: 20 });
    const { text } = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(text).toContain("FROM artists");
    expect(text).toContain(
      `COUNT(*) FILTER (WHERE "instagram" IS NOT NULL AND "instagram" != '')::int AS col_instagram`,
    );
    expect(text).not.toContain("col_spotify");
  });

  it("is all zeros without a row", async () => {
    mock.execute.mockResolvedValueOnce([]);
    expect(await getArtistTotalsAndCoverage()).toEqual({
      totalArtists: 0,
      totalWithSpotify: 0,
      columnCounts: {},
      enrichment: { hasWikidata: 0, hasSpotifyNoWikidata: 0, noSpotify: 0 },
    });
  });
});
