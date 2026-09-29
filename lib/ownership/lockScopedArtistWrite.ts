import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { authorizeLockedArtistWrite } from "@/lib/ownership/authorizeLockedArtistWrite";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import type { TransactionDb } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Inside a running operation, locks the artist row and re-checks ownership, in
 * an existing transaction (after any advisory locks it already holds).
 *
 * @param tx - The write's transaction.
 * @param artistId - The artist.
 * @returns Nothing; throws OwnershipChangedError when the claim changed.
 */
export async function lockScopedArtistWrite(tx: TransactionDb, artistId: string): Promise<void> {
  const context = getArtistOperationOwnership(artistId);
  if (!context) return;
  await lockArtistRow(tx, artistId);
  if (context.userId) {
    await authorizeLockedArtistWrite(tx, artistId, {
      userId: context.userId,
      expectedClaimId: context.expectedClaimId,
    });
    return;
  }
  const claim = await findApprovedClaim(tx, artistId);
  if ((claim?.id ?? null) !== context.expectedClaimId) throw new OwnershipChangedError();
}
