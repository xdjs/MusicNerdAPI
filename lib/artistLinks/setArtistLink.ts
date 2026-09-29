import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";
import { assertWritableLinkColumn } from "@/lib/artistLinks/assertWritableLinkColumn";
import { sanitizeColumnName } from "@/lib/artistLinks/sanitizeColumnName";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { db } from "@/lib/db/db";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Writes one of the artist's platform links. spotify and deezer ids take the
 * advisory locks shared with MusicNerdWeb before the artist row lock; every
 * other column is one scoped write. Inside an artist operation both paths
 * re-check the claim first.
 *
 * MusicNerdWeb's self-edit recording (`selfEditUrl`) isn't ported: research
 * never passes one.
 *
 * @param artistId - The artist.
 * @param siteName - The platform, sanitized to a column name.
 * @param value - The id or handle.
 * @returns The previous value and the artist's name.
 */
export async function setArtistLink(
  artistId: string,
  siteName: string,
  value: string,
): Promise<{ oldValue: string | null; artistName: string | null }> {
  const columnName = sanitizeColumnName(siteName);
  assertWritableLinkColumn(columnName);
  if (!value) throw new Error("Value must not be empty");

  if (columnName === "spotify" || columnName === "deezer") {
    return db.transaction(async transaction => {
      await acquireArtistPlatformWriteLocks(transaction, artistId, columnName, value);
      await lockScopedArtistWrite(transaction, artistId);
      return writeArtistLinkColumn(transaction, artistId, columnName, value);
    });
  }
  return withScopedArtistWrite(artistId, tx =>
    writeArtistLinkColumn(tx, artistId, columnName, value),
  );
}
