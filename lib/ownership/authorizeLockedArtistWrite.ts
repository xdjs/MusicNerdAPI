import { and, eq } from "drizzle-orm";
import { artistClaims, users } from "@/lib/db/schema";
import type { ArtistWriteAuth, TransactionDb } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Checks, after the artist row lock is taken, that the claim is still the one
 * the operation started under and that the user may write: the claimant, or an
 * admin (claim approval runs source research as the approving admin).
 *
 * @param tx - The transaction holding the artist row lock.
 * @param artistId - The artist.
 * @param auth - The user and expected claim.
 * @returns Nothing; throws OwnershipChangedError when the write isn't allowed.
 */
export async function authorizeLockedArtistWrite(
  tx: TransactionDb,
  artistId: string,
  auth: ArtistWriteAuth,
): Promise<void> {
  const claim = await tx.query.artistClaims.findFirst({
    where: and(eq(artistClaims.artistId, artistId), eq(artistClaims.status, "approved")),
  });
  if ((claim?.id ?? null) !== auth.expectedClaimId) throw new OwnershipChangedError();
  if (claim?.userId !== auth.userId) {
    const user = await tx.query.users.findFirst({ where: eq(users.id, auth.userId) });
    if (!user?.isAdmin) throw new OwnershipChangedError();
  }
}
