import { sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { foldName } from "@/lib/text/foldName";

/**
 * Is this the generic artist among several sharing a name? "Black Dave" is a
 * prefix of "Black Dave MK2", so no page can prove it means the shorter one;
 * the specific name is not caught. A page title repeating an ambiguous name
 * proves nothing about whose account it is.
 *
 * @param artistId - The artist.
 * @param artistName - Their name.
 * @returns True when another artist's folded name starts with this one, when the name is under four characters, and on error (fails closed).
 */
export async function nameIsAmbiguousInDirectory(
  artistId: string,
  artistName: string,
): Promise<boolean> {
  const folded = foldName(artistName);
  if (folded.length < 4) return true;
  try {
    const rows = await db.execute(sql`
      select 1 from artists
      where regexp_replace(lower(normalize(name, NFKD) collate "C"), '[^a-z0-9]', '', 'g') like ${folded + "%"}
        and id <> ${artistId}::uuid
      limit 1`);
    return rowsOf(rows).length > 0;
  } catch (e) {
    console.error("[vaultWebSearch] Ambiguity check failed, treating name as ambiguous:", e);
    return true;
  }
}
