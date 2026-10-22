import { sql } from "drizzle-orm";
import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import type { EnrichmentReadiness } from "@/lib/artistData/types";
import { db } from "@/lib/db/db";

/**
 * Total counts, per-column coverage and enrichment readiness in a single scan
 * of `artists`, with explicit `col_<name>` aliases for key-based access.
 *
 * @returns The totals, each tracked column's non-empty count, and the readiness counts.
 */
export async function getArtistTotalsAndCoverage(): Promise<{
  totalArtists: number;
  totalWithSpotify: number;
  columnCounts: Record<string, number>;
  enrichment: EnrichmentReadiness;
}> {
  // Build dynamic FILTER clauses with explicit aliases (col_<name>)
  const columnFilters = TRACKED_COLUMNS.map(
    ({ column }) =>
      sql`COUNT(*) FILTER (WHERE ${sql.identifier(column)} IS NOT NULL AND ${sql.identifier(column)} != '')::int AS ${sql.raw(`col_${column}`)}`,
  );

  const query = sql`
    SELECT
      COUNT(*)::int AS total_artists,
      COUNT(*) FILTER (WHERE spotify IS NOT NULL AND spotify != '')::int AS total_with_spotify,
      ${sql.join(columnFilters, sql`, `)},
      COUNT(*) FILTER (WHERE wikidata IS NOT NULL AND wikidata != '')::int AS has_wikidata,
      COUNT(*) FILTER (WHERE spotify IS NOT NULL AND spotify != '' AND (wikidata IS NULL OR wikidata = ''))::int AS has_spotify_no_wikidata,
      COUNT(*) FILTER (WHERE spotify IS NULL OR spotify = '')::int AS no_spotify
    FROM artists
  `;

  const rows = await db.execute(query);
  const row = rows[0] as Record<string, number> | undefined;
  if (!row) {
    return {
      totalArtists: 0,
      totalWithSpotify: 0,
      columnCounts: {} as Record<string, number>,
      enrichment: { hasWikidata: 0, hasSpotifyNoWikidata: 0, noSpotify: 0 },
    };
  }

  const totalArtists = row.total_artists ?? 0;
  const totalWithSpotify = row.total_with_spotify ?? 0;

  const columnCounts: Record<string, number> = {};
  for (const { column } of TRACKED_COLUMNS) {
    columnCounts[column] = row[`col_${column}`] ?? 0;
  }

  return {
    totalArtists,
    totalWithSpotify,
    columnCounts,
    enrichment: {
      hasWikidata: row.has_wikidata ?? 0,
      hasSpotifyNoWikidata: row.has_spotify_no_wikidata ?? 0,
      noSpotify: row.no_spotify ?? 0,
    },
  };
}
