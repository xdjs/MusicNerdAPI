import { disconnectCatalogLink } from "@/lib/artistLinks/disconnectCatalogLink";
import { assertWritableLinkColumn } from "@/lib/artistLinks/assertWritableLinkColumn";
import { clearArtistLinkColumn } from "@/lib/artistLinks/clearArtistLinkColumn";
import { sanitizeColumnName } from "@/lib/artistLinks/sanitizeColumnName";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Removes a link from an artist. Spotify and Deezer take the same platform-slot
 * lock as `setArtistLink`, so a removal and a write for that slot serialize,
 * in both apps. Catalog clears require an authenticated user and displayed ID,
 * archive their exact mapping atomically, and do not touch the bio.
 *
 * @param artistId - The artist.
 * @param siteName - The link column.
 * @param expectedValue - Displayed catalog ID, required for catalog clear.
 * @param authorization - Existing owner or contributor contract.
 * @returns The value it held. Throws for a column that isn't a writable link.
 */
export async function clearArtistLink(
  artistId: string,
  siteName: string,
  expectedValue?: string | null,
  authorization: "owner" | "contributor" = "owner",
): Promise<{ oldValue: string | null }> {
  const columnName = sanitizeColumnName(siteName);
  assertWritableLinkColumn(columnName);
  if (columnName === "spotify" || columnName === "deezer") {
    return disconnectCatalogLink(artistId, columnName, expectedValue, authorization);
  }
  return withScopedArtistWrite(artistId, tx => clearArtistLinkColumn(tx, artistId, columnName));
}
