import { sql } from "drizzle-orm";
import { PLATFORM_DOMAINS } from "@/lib/artists/const";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";

/**
 * Is this (platform, handle) already another artist's? Names collide (three
 * Black Daves are in the directory) and page titles can't settle it; what the
 * directory already holds can.
 *
 * @param artistId - The artist the handle would go to.
 * @param siteName - The platform column.
 * @param handle - The candidate handle.
 * @returns True when another artist holds it, and on a database error (fails closed: a gap beats a wrong link).
 */
export async function handleBelongsToAnotherArtist(
  artistId: string,
  siteName: string,
  handle: string,
): Promise<boolean> {
  if (!PLATFORM_DOMAINS[siteName]) return false;
  try {
    // siteName is a column name, so it is interpolated: safe only behind the
    // PLATFORM_DOMAINS check above. Values are always bound. Both sides are
    // ltrimmed of "@", since some rows carry the legacy "@handle" form.
    const rows = await db.execute(sql`select 1 from artists
      where lower(ltrim(${sql.raw(siteName)}, '@')) = lower(ltrim(${handle}, '@'))
        and id::text <> ${artistId}
      limit 1`);
    return rowsOf(rows).length > 0;
  } catch (e) {
    console.error("[vaultWebSearch] Ownership check failed, treating handle as claimed:", e);
    return true;
  }
}
