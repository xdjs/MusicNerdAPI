import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getArtistTotalsAndCoverage } = await import("@/lib/artistData/getArtistTotalsAndCoverage");

describe("getArtistTotalsAndCoverage", () => {
  it("reads totals, per-column counts and readiness from one row", async () => {
    execute.mockResolvedValueOnce([
      {
        total_artists: 100,
        total_with_spotify: 80,
        col_instagram: 40,
        col_bio: 10,
        has_wikidata: 30,
        has_spotify_no_wikidata: 50,
        no_spotify: 20,
      },
    ]);
    const result = await getArtistTotalsAndCoverage();
    expect(result).toMatchObject({
      totalArtists: 100,
      totalWithSpotify: 80,
      enrichment: { hasWikidata: 30, hasSpotifyNoWikidata: 50, noSpotify: 20 },
    });
    expect(result.columnCounts.instagram).toBe(40);
    expect(result.columnCounts.patreon).toBe(0);
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL);
    expect(q.sql).toContain('"instagram" is not null');
    expect(q.params).toEqual([]);
  });

  it("is all zeros for an empty result", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await getArtistTotalsAndCoverage()).toMatchObject({
      totalArtists: 0,
      totalWithSpotify: 0,
    });
  });
});
