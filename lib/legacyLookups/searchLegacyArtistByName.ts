import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { normaliseLegacyName } from "@/lib/legacyLookups/normaliseLegacyName";

/**
 * The best match for a name, ranked as MusicNerdWeb's `searchForArtistByName`
 * ranks it: substring matches on `lcname` first (in either the normalised or
 * the space-less form, earliest position first), then trigram similarity
 * (`%`, pg_trgm's default 0.3 threshold).
 *
 * @param name - The name searched for.
 * @returns The top artist's `x`, or undefined; throws on a database error.
 */
export async function searchLegacyArtistByName(
  name: string,
): Promise<{ x: string | null } | undefined> {
  const query = normaliseLegacyName(name);
  const compact = query.replace(/\s+/g, "");
  const twoForms = compact && compact !== query;
  const nameMatch = twoForms
    ? sql`(lcname LIKE '%' || ${query} || '%' OR lcname LIKE '%' || ${compact} || '%')`
    : sql`lcname LIKE '%' || ${query} || '%'`;
  const matchPosition = twoForms
    ? sql`COALESCE(NULLIF(POSITION(${query} IN lcname), 0), POSITION(${compact} IN lcname))`
    : sql`POSITION(${query} IN lcname)`;
  const rows = await db.execute<{ x: string | null }>(sql`
    SELECT x
    FROM artists
    WHERE ${nameMatch} OR lcname % ${query}
    ORDER BY
      CASE WHEN ${nameMatch} THEN 0 ELSE 1 END ASC,
      CASE WHEN ${nameMatch} THEN -${matchPosition} ELSE -999999 END DESC,
      similarity(lcname, ${query}) DESC
    LIMIT 1
  `);
  return rows[0];
}
