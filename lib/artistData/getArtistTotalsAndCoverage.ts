import { sql } from "drizzle-orm";
import { TRACKED_COLUMNS } from "@/lib/artistData/const";
import type { EnrichmentReadiness } from "@/lib/artistData/types";
import { db } from "@/lib/db/db";

/**
 * One scan of `artists`: totals, how many have each tracked column, and
 * enrichment readiness. Columns come only from `TRACKED_COLUMNS`.
 *
 * @returns Totals, per-column counts and readiness.
 */
export async function getArtistTotalsAndCoverage(): Promise<{
  totalArtists: number;
  totalWithSpotify: number;
  columnCounts: Record<string, number>;
  enrichment: EnrichmentReadiness;
}> {
  const filters = TRACKED_COLUMNS.map(
    ({ column }) =>
      sql`count(*) filter (where ${sql.identifier(column)} is not null and ${sql.identifier(column)} != '')::int as ${sql.identifier(`col_${column}`)}`,
  );
  const [row] = (await db.execute(sql`select
      count(*)::int as total_artists,
      count(*) filter (where spotify is not null and spotify != '')::int as total_with_spotify,
      ${sql.join(filters, sql`, `)},
      count(*) filter (where wikidata is not null and wikidata != '')::int as has_wikidata,
      count(*) filter (where spotify is not null and spotify != '' and (wikidata is null or wikidata = ''))::int as has_spotify_no_wikidata,
      count(*) filter (where spotify is null or spotify = '')::int as no_spotify
    from artists`)) as unknown as (Record<string, number> | undefined)[];
  return {
    totalArtists: row?.total_artists ?? 0,
    totalWithSpotify: row?.total_with_spotify ?? 0,
    columnCounts: Object.fromEntries(
      TRACKED_COLUMNS.map(({ column }) => [column, row?.[`col_${column}`] ?? 0]),
    ),
    enrichment: {
      hasWikidata: row?.has_wikidata ?? 0,
      hasSpotifyNoWikidata: row?.has_spotify_no_wikidata ?? 0,
      noSpotify: row?.no_spotify ?? 0,
    },
  };
}
