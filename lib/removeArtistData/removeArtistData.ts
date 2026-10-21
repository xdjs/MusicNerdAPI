import { sql } from "drizzle-orm";
import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";
import { db } from "@/lib/db/db";

/**
 * Empties one platform column on an artist, as MusicNerdWeb's contributor-side
 * remove did. The contributor's UGC row is kept so their credit stands.
 * `wallets` takes the array path, which removes the artist's own id from the
 * array: MusicNerdWeb's known quirk, kept so both apps behave the same.
 *
 * @param artistId - The artist.
 * @param siteName - The platform column.
 * @returns `{ status: "success" }`, or `{ status: "error", message }` for a column that isn't a writable link or a failed write.
 */
export async function removeArtistData(
  artistId: string,
  siteName: string,
): Promise<{ status: "success" | "error"; message: string }> {
  try {
    if (siteName === "wallets" || siteName === "wallet") {
      await db.execute(sql`
        UPDATE artists
        SET wallets = array_remove(wallets, ${artistId})
        WHERE id = ${artistId}`);
    } else {
      await clearArtistLink(artistId, siteName);
    }
    return { status: "success", message: "Artist data removed" };
  } catch (e) {
    console.error("Error removing artist data", e);
    if (e instanceof Error && e.message.startsWith("Column not in writable whitelist"))
      return { status: "error", message: "Invalid platform column" };
    return { status: "error", message: "Error removing artist data" };
  }
}
