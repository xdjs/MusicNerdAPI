import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";

export type ArtistSearchRow = {
  id: string;
  name: string | null;
  spotify: string | null;
  deezer: string | null;
  bandcamp: string | null;
  youtube: string | null;
  youtubechannel: string | null;
  instagram: string | null;
  x: string | null;
  facebook: string | null;
  tiktok: string | null;
  customImage: string | null;
};

/**
 * Normalise text for search comparison: lower-case, remove accents and punctuation.
 *
 * @param input - The raw input string.
 * @returns The normalised string.
 */
function normaliseText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .toLowerCase();
}

/**
 * Trigram + substring artist search against the `lcname` column.
 *
 * @param name - The search query.
 * @returns Up to 10 matching artist rows.
 */
export async function searchArtistsByName(name: string): Promise<ArtistSearchRow[]> {
  const normalisedQuery = normaliseText(name);
  const compactQuery = normalisedQuery.replace(/\s+/g, "");

  const nameMatch =
    compactQuery && compactQuery !== normalisedQuery
      ? sql`(lcname LIKE '%' || ${normalisedQuery} || '%' OR lcname LIKE '%' || ${compactQuery} || '%')`
      : sql`lcname LIKE '%' || ${normalisedQuery} || '%'`;
  const matchPosition =
    compactQuery && compactQuery !== normalisedQuery
      ? sql`COALESCE(NULLIF(POSITION(${normalisedQuery} IN lcname), 0), POSITION(${compactQuery} IN lcname))`
      : sql`POSITION(${normalisedQuery} IN lcname)`;

  return db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL pg_trgm.similarity_threshold = 0.3;`);

    return tx.execute<ArtistSearchRow>(sql`
      SELECT
        id, name, spotify, deezer, bandcamp, youtube, youtubechannel,
        instagram, x, facebook, tiktok,
        custom_image AS "customImage"
      FROM artists
      WHERE
        ${nameMatch}
        OR lcname % ${normalisedQuery}
      ORDER BY
        CASE WHEN ${nameMatch} THEN 0 ELSE 1 END ASC,
        CASE
          WHEN ${nameMatch}
          THEN -${matchPosition}
          ELSE -999999
        END DESC,
        similarity(lcname, ${normalisedQuery}) DESC
      LIMIT 10;
    `);
  });
}
