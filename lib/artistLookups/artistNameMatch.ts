import { sql, type SQL } from "drizzle-orm";
import { normaliseArtistName } from "@/lib/artistLookups/normaliseArtistName";

/**
 * The name match MusicNerdWeb's `searchForArtistByName` ranks on. Older
 * `lcname` values omit spaces ("peterango") while new ones keep them, so a
 * spaced name matches either form; otherwise an existing artist can be missed.
 *
 * @param name - The name searched for.
 * @returns The normalised `query`, the `nameMatch` condition on `lcname`, and
 * the `matchPosition` of the earliest match.
 */
export function artistNameMatch(name: string): {
  query: string;
  nameMatch: SQL;
  matchPosition: SQL;
} {
  const query = normaliseArtistName(name);
  const compact = query.replace(/\s+/g, "");
  const twoForms = compact && compact !== query;
  return {
    query,
    nameMatch: twoForms
      ? sql`(lcname LIKE '%' || ${query} || '%' OR lcname LIKE '%' || ${compact} || '%')`
      : sql`lcname LIKE '%' || ${query} || '%'`,
    matchPosition: twoForms
      ? sql`COALESCE(NULLIF(POSITION(${query} IN lcname), 0), POSITION(${compact} IN lcname))`
      : sql`POSITION(${query} IN lcname)`,
  };
}
