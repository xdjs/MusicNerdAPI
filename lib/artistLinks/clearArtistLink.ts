import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";
import { assertWritableLinkColumn } from "@/lib/artistLinks/assertWritableLinkColumn";
import { clearArtistLinkColumn } from "@/lib/artistLinks/clearArtistLinkColumn";
import { sanitizeColumnName } from "@/lib/artistLinks/sanitizeColumnName";
import { db } from "@/lib/db/db";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Removes a link from an artist. Spotify and Deezer take the same platform-slot
 * lock as `setArtistLink`, so a removal and a write for that slot serialize,
 * in both apps. Doesn't touch the bio.
 *
 * @param artistId - The artist.
 * @param siteName - The link column.
 * @returns The value it held. Throws for a column that isn't a writable link.
 */
export async function clearArtistLink(
  artistId: string,
  siteName: string,
): Promise<{ oldValue: string | null }> {
  const columnName = sanitizeColumnName(siteName);
  assertWritableLinkColumn(columnName);
  if (columnName === "spotify" || columnName === "deezer") {
    return db.transaction(async transaction => {
      await acquireArtistPlatformLock(transaction, artistId, columnName);
      await lockScopedArtistWrite(transaction, artistId);
      return clearArtistLinkColumn(transaction, artistId, columnName);
    });
  }
  return withScopedArtistWrite(artistId, tx => clearArtistLinkColumn(tx, artistId, columnName));
}
