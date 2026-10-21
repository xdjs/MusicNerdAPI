import { sql } from "drizzle-orm";
import type { TransactionDb } from "@/lib/ownership/types";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Locks the artist (the same lock claim changes take) and holds the user's
 * role and the approved claim through the review, then checks the user is the
 * claimant or an admin.
 *
 * @param tx - The review's transaction.
 * @param artistId - The artist.
 * @param userId - The reviewing user.
 * @returns Nothing; throws OwnershipChangedError when the user may not review.
 */
export async function lockLinkReview(
  tx: Pick<TransactionDb, "execute">,
  artistId: string,
  userId: string,
): Promise<void> {
  const [artist] = await tx.execute(
    sql`select id from artists where id=${artistId}::uuid for update`,
  );
  const [user] = await tx.execute<{ is_admin: boolean }>(
    sql`select is_admin from users where id=${userId}::uuid for share`,
  );
  const [claim] = await tx.execute<{ user_id: string }>(
    sql`select user_id from artist_claims where artist_id=${artistId}::uuid and status='approved' for share`,
  );
  if (!artist || !user || (!user.is_admin && claim?.user_id !== userId))
    throw new OwnershipChangedError();
}
