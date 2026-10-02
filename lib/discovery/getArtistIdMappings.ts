import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import type { IdMappingRow } from "@/lib/discovery/types";

/**
 * The artist's resolved cross-platform ids, with the confidence and source
 * tier 1 reports. MusicNerdWeb also threw for an unknown artist when there
 * were no rows; discovery reads the artist first, so that check isn't needed.
 *
 * @param artistId - The artist.
 * @returns The mappings. A database error throws; tier 1 catches it.
 */
export async function getArtistIdMappings(artistId: string): Promise<IdMappingRow[]> {
  const rows = await db.execute(sql`
    select platform, platform_id, confidence::text as confidence, source
      from artist_id_mappings where artist_id = ${artistId}::uuid order by platform`);
  return rowsOf(rows).map(r => {
    const row = r as Record<string, unknown>;
    return {
      platform: String(row.platform),
      platformId: String(row.platform_id),
      confidence: String(row.confidence),
      source: String(row.source),
    };
  });
}
