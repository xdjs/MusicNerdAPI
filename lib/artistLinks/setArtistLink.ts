import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { catalogLinkWasDisconnected } from "@/lib/artistLinks/catalogLinkWasDisconnected";
import { canSaveMusicDestination } from "@/lib/musicLinks/canSaveMusicDestination";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import type { CatalogWriteEvidence } from "@/lib/providerIdentity/types";
import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";
import { assertWritableLinkColumn } from "@/lib/artistLinks/assertWritableLinkColumn";
import { sanitizeColumnName } from "@/lib/artistLinks/sanitizeColumnName";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { db } from "@/lib/db/db";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import type { TransactionDb } from "@/lib/ownership/types";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * Writes one of the artist's platform links. spotify and deezer ids take the
 * advisory locks shared with MusicNerdWeb before the artist row lock; every
 * other column is one scoped write. Inside an artist operation both paths
 * re-check the claim first.
 *
 * @param artistId - The artist.
 * @param siteName - The platform, sanitized to a column name.
 * @param value - The id or handle.
 * @param selfEditUrl - The URL a claimant submitted, to record their self-edit; needs a user operation.
 * @param transaction - A transaction to write in instead of opening one (a link review's).
 * @param evidence - Exact source and target values observed by automatic verification.
 * @returns The previous value and the artist's name.
 */
export async function setArtistLink(
  artistId: string,
  siteName: string,
  value: string,
  selfEditUrl?: string,
  transaction?: TransactionDb,
  evidence?: CatalogWriteEvidence,
): Promise<{ oldValue: string | null; artistName: string | null }> {
  if (selfEditUrl && !getArtistOperationOwnership(artistId)?.userId)
    throw new Error("Self-edit recording requires an authenticated artist operation");
  const columnName = sanitizeColumnName(siteName);
  assertWritableLinkColumn(columnName);
  if (!value) throw new Error("Value must not be empty");

  const identity = columnName === "spotify" || columnName === "deezer";
  const write = async (tx: TransactionDb) => {
    if (identity) await acquireArtistPlatformWriteLocks(tx, artistId, columnName, value);
    if (evidence) await lockArtistRow(tx, artistId);
    await lockScopedArtistWrite(tx, artistId);
    if (evidence) {
      if (await catalogLinkWasDisconnected(tx, artistId, columnName))
        throw new ArtistLinkConflictError(
          "This catalog was disconnected; explicit confirmation is required to reconnect",
        );
      const url =
        columnName === "spotify"
          ? `https://open.spotify.com/artist/${value}`
          : `https://www.deezer.com/artist/${value}`;
      if (
        !(await canSaveMusicDestination(tx, artistId, url, { allowExistingSameDestination: true }))
      )
        throw new ArtistLinkConflictError(
          "Automatic catalog match conflicts with a saved identity or review decision",
        );
    }
    return writeArtistLinkColumn(tx, artistId, columnName, value, selfEditUrl, evidence);
  };
  if (transaction) return write(transaction);
  if (identity) return db.transaction(write);
  return withScopedArtistWrite(artistId, tx =>
    writeArtistLinkColumn(tx, artistId, columnName, value, selfEditUrl, evidence),
  );
}
