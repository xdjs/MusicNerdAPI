import { setArtistLink } from "@/lib/artistLinks/setArtistLink";

/**
 * Writes a link, then stops calling the column provisional and updates the
 * in-memory snapshot, so a later gate in the same run sees the answer. Without
 * this, one run wrote bandcamp three times for Sherwinn Brice and the last,
 * another artist's, won. Every link write in the search goes through here.
 *
 * @param artistId - The artist.
 * @param siteName - The platform column.
 * @param value - The handle or id.
 * @param provisional - Columns still holding a guess; the written one is removed.
 * @param record - The snapshot the gates read; the written value is set on it.
 * @returns Once written; throws what setArtistLink throws.
 */
export async function writeArtistLink(
  artistId: string,
  siteName: string,
  value: string,
  provisional?: Set<string>,
  record?: Record<string, unknown>,
): Promise<void> {
  await setArtistLink(artistId, siteName, value);
  provisional?.delete(siteName);
  if (record) record[siteName] = value;
}
