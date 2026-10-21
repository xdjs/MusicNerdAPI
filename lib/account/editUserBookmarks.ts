import { and, eq, inArray } from "drizzle-orm";
import { existingBookmarks } from "@/lib/account/existingBookmarks";
import { getUserBookmarks } from "@/lib/account/getUserBookmarks";
import { lockBookmarkUsers } from "@/lib/account/lockBookmarkUsers";
import type { BookmarkItem } from "@/lib/account/types";
import { writeBookmarkOrder } from "@/lib/account/writeBookmarkOrder";
import { db } from "@/lib/db/db";
import { userArtistBookmarks } from "@/lib/db/schema";

/**
 * Applies a saved-order draft: removes, then reorders the survivors. A stale
 * client's draft cannot erase new bookmarks or resurrect a removal: unlisted
 * current entries stay first and only the surviving draft is reordered.
 *
 * @param userId - The account.
 * @param orderedArtistIds - The draft's order.
 * @param removedArtistIds - The artists to remove.
 * @returns The whole list after the edit.
 */
export async function editUserBookmarks(
  userId: string,
  orderedArtistIds: string[],
  removedArtistIds: string[],
): Promise<BookmarkItem[]> {
  return db.transaction(async tx => {
    await lockBookmarkUsers(tx, [userId]);
    if (removedArtistIds.length) {
      await tx
        .update(userArtistBookmarks)
        .set({ removedAt: new Date().toISOString() })
        .where(
          and(
            eq(userArtistBookmarks.userId, userId),
            inArray(userArtistBookmarks.artistId, removedArtistIds),
          ),
        );
    }
    const existing = await existingBookmarks(tx, userId);
    const remaining = new Set(existing.map(({ artistId }) => artistId));
    const requested = [...new Set(orderedArtistIds)].filter(id => remaining.has(id));
    const requestedSet = new Set(requested);
    const order = [
      ...existing.map(({ artistId }) => artistId).filter(id => !requestedSet.has(id)),
      ...requested,
    ];
    await writeBookmarkOrder(tx, userId, order);
    return getUserBookmarks(userId, tx);
  });
}
