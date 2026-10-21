import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import type { TransactionDb } from "@/lib/ownership/types";

/**
 * One upload's database write, re-authorized under the artist row lock: the
 * claim must still be the one the upload started under, and the user must be
 * its claimant or an admin. Only the short write is locked, never the
 * storage work around it.
 *
 * @param artistId - The artist.
 * @param userId - The uploading user.
 * @param expectedClaimId - The approved claim when the upload started, or null.
 * @param write - The write, given the transaction.
 * @returns What `write` returns; throws OwnershipChangedError when the claim changed.
 */
export async function withArtistUploadWrite<T>(
  artistId: string,
  userId: string,
  expectedClaimId: string | null,
  write: (tx: TransactionDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    await authorizeLockedArtistWrite(tx, artistId, { userId, expectedClaimId });
    return write(tx);
  });
}
