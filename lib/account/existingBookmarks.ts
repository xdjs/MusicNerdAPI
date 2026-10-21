import { and, asc, eq, isNull } from "drizzle-orm";
import type { Transaction } from "@/lib/account/types";
import { userArtistBookmarks } from "@/lib/db/schema";

/**
 * The user's current (not removed) bookmarks in saved order, read inside a
 * write's transaction after the account lock.
 *
 * @param tx - The open transaction.
 * @param userId - The account.
 * @returns Each bookmark's artist id and creation time.
 */
export async function existingBookmarks(
  tx: Transaction,
  userId: string,
): Promise<{ artistId: string; createdAt: string }[]> {
  return tx
    .select({ artistId: userArtistBookmarks.artistId, createdAt: userArtistBookmarks.createdAt })
    .from(userArtistBookmarks)
    .where(and(eq(userArtistBookmarks.userId, userId), isNull(userArtistBookmarks.removedAt)))
    .orderBy(
      asc(userArtistBookmarks.position),
      asc(userArtistBookmarks.createdAt),
      asc(userArtistBookmarks.artistId),
    );
}
