import { eq, sql } from "drizzle-orm";
import type { db } from "@/lib/db/db";
import { artistSelfEdits, users } from "@/lib/db/schema";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Records a claimant's own link change, inside the authorized artist-row
 * transaction after the write. The claim is re-read (not locked: revocation
 * takes claim then artist locks, and this transaction already holds the
 * artist's). An admin editing someone else's artist is not a self-edit.
 *
 * @param transaction - The link write's transaction.
 * @param artistId - The artist.
 * @param siteName - The column written.
 * @param oldValue - Its previous value.
 * @param newValue - Its new value.
 * @param submittedUrl - The URL the user submitted.
 * @returns Nothing; throws OwnershipChangedError when the claim or role changed.
 */
export async function recordArtistSelfEdit(
  transaction: Pick<typeof db, "query" | "insert" | "execute">,
  artistId: string,
  siteName: string,
  oldValue: string | null,
  newValue: string,
  submittedUrl: string,
): Promise<void> {
  const ownership = getArtistOperationOwnership(artistId);
  if (!ownership?.userId || !ownership.expectedClaimId || oldValue === newValue) return;
  const [claim] = await transaction.execute<{ user_id: string }>(sql`
    SELECT user_id FROM artist_claims
    WHERE id = ${ownership.expectedClaimId}::uuid AND artist_id = ${artistId}::uuid
      AND status = 'approved'
  `);
  if (!claim) throw new OwnershipChangedError();
  if (claim.user_id !== ownership.userId) {
    const user = await transaction.query.users.findFirst({
      where: eq(users.id, ownership.userId),
    });
    if (!user?.isAdmin) throw new OwnershipChangedError();
    return;
  }
  await transaction.insert(artistSelfEdits).values({
    artistId,
    userId: ownership.userId,
    siteName,
    oldValue,
    newValue,
    submittedUrl,
  });
}
