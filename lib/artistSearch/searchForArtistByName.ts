import { sql } from "drizzle-orm";
import { artistNameMatch } from "@/lib/artistLookups/artistNameMatch";
import type { ArtistSearchRow } from "@/lib/artistSearch/types";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * Up to ten artists matching a name, with the columns and ranking of
 * MusicNerdWeb's `searchForArtistByName`: substring matches on `lcname` first
 * (earliest position first), then trigram similarity (`%`, pg_trgm's default
 * 0.3 threshold, the value MusicNerdWeb set).
 *
 * @param name - The name searched for.
 * @returns The rows; throws "Error searching for artist by name" on a database error.
 */
export async function searchForArtistByName(name: string): Promise<ArtistSearchRow[]> {
  try {
    const { query, nameMatch, matchPosition } = artistNameMatch(name);
    return rowsOf(
      await db.execute(sql`
            SELECT
            id, name, spotify, deezer, bandcamp, youtube, youtubechannel,
            instagram, x, facebook, tiktok,
            custom_image AS "customImage",
            CASE WHEN ${nameMatch} THEN 0 ELSE 1 END AS match_type
            FROM artists
            WHERE
            ${nameMatch}
            OR lcname % ${query}          -- ← indexable equivalent to similarity(...) >= 0.3
            ORDER BY
            match_type ASC,
            CASE
                WHEN ${nameMatch}
                THEN -${matchPosition}
                ELSE -999999
            END DESC,
            similarity(lcname, ${query}) DESC   -- keep for ranking
            LIMIT 10;
        `),
    ) as ArtistSearchRow[];
  } catch (e) {
    console.error("Error fetching artist by name", e);
    throw new Error("Error searching for artist by name");
  }
}
