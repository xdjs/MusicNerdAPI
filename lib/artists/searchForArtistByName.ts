import { sql } from "drizzle-orm";
import { normaliseArtistName } from "@/lib/artistLookups/normaliseArtistName";
import type { ArtistSearchRow } from "@/lib/artists/types";
import { db } from "@/lib/db/db";

/**
 * Artists whose name matches, as MusicNerdWeb's `searchForArtistByName` ranks
 * them: substring matches on `lcname` first (in the normalised or the
 * space-less form, earliest position first), then trigram similarity, ten at
 * most. Older `lcname` values omit spaces, so both forms are tried.
 *
 * @param name - The name searched for.
 * @returns The matching rows; throws on a database error.
 */
export async function searchForArtistByName(name: string): Promise<ArtistSearchRow[]> {
  try {
    const startTime = performance.now();
    const normalisedQuery = normaliseArtistName(name);
    const compactQuery = normalisedQuery.replace(/\s+/g, "");
    const nameMatch =
      compactQuery && compactQuery !== normalisedQuery
        ? sql`(lcname LIKE '%' || ${normalisedQuery} || '%' OR lcname LIKE '%' || ${compactQuery} || '%')`
        : sql`lcname LIKE '%' || ${normalisedQuery} || '%'`;
    const matchPosition =
      compactQuery && compactQuery !== normalisedQuery
        ? sql`COALESCE(NULLIF(POSITION(${normalisedQuery} IN lcname), 0), POSITION(${compactQuery} IN lcname))`
        : sql`POSITION(${normalisedQuery} IN lcname)`;

    try {
      await db.execute(sql`SET LOCAL pg_trgm.similarity_threshold = 0.3;`);
    } catch (err) {
      console.error("Error setting pg_trgm similarity threshold", err);
      throw err;
    }
    const result = await db.execute<ArtistSearchRow>(sql`
      SELECT
      id, name, spotify, deezer, bandcamp, youtube, youtubechannel,
      instagram, x, facebook, tiktok,
      custom_image AS "customImage",
      CASE WHEN ${nameMatch} THEN 0 ELSE 1 END AS match_type
      FROM artists
      WHERE
      ${nameMatch}
      OR lcname % ${normalisedQuery}
      ORDER BY
      match_type ASC,
      CASE
          WHEN ${nameMatch}
          THEN -${matchPosition}
          ELSE -999999
      END DESC,
      similarity(lcname, ${normalisedQuery}) DESC
      LIMIT 10;
    `);

    console.debug(
      `Search for "${name}" (normalised: "${normalisedQuery}") took ${performance.now() - startTime}ms`,
    );
    return [...result];
  } catch (e) {
    console.error("Error fetching artist by name", e);
    throw new Error("Error searching for artist by name");
  }
}
