import { inArray } from "drizzle-orm";
import { existingBookmarks } from "@/lib/account/existingBookmarks";
import { getUserBookmarks } from "@/lib/account/getUserBookmarks";
import { lockBookmarkUsers } from "@/lib/account/lockBookmarkUsers";
import type { BookmarkItem } from "@/lib/account/types";
import { writeBookmarkOrder } from "@/lib/account/writeBookmarkOrder";
import { db } from "@/lib/db/db";
import { artists, userArtistBookmarks } from "@/lib/db/schema";

/**
 * Saves artists to the user's bookmarks, new ones first in the order given.
 * Already-saved artists keep their place and unknown artist ids are ignored.
 * An import leaves removed artists removed; an ordinary add brings them back.
 *
 * @param userId - The account.
 * @param artistIds - The artists to add.
 * @param importing - True when importing the browser's old list.
 * @returns The whole list after the additions.
 */
export async function addUserBookmarks(
  userId: string,
  artistIds: string[],
  importing = false,
): Promise<BookmarkItem[]> {
  return db.transaction(async tx => {
    await lockBookmarkUsers(tx, [userId]);
    const existing = await existingBookmarks(tx, userId);
    const existingIds = new Set(existing.map(({ artistId }) => artistId));
    const requested = [...new Set(artistIds)].filter(id => !existingIds.has(id));
    if (requested.length) {
      const valid = await tx
        .select({ id: artists.id })
        .from(artists)
        .where(inArray(artists.id, requested));
      const validIds = new Set(valid.map(({ id }) => id));
      const additions = requested.filter(id => validIds.has(id));
      if (additions.length) {
        const insert = tx
          .insert(userArtistBookmarks)
          .values(additions.map((artistId, position) => ({ userId, artistId, position })));
        if (importing)
          await insert.onConflictDoNothing({
            target: [userArtistBookmarks.userId, userArtistBookmarks.artistId],
          });
        else
          await insert.onConflictDoUpdate({
            target: [userArtistBookmarks.userId, userArtistBookmarks.artistId],
            set: { removedAt: null },
          });
        await writeBookmarkOrder(tx, userId, [
          ...additions,
          ...existing.map(({ artistId }) => artistId),
        ]);
      }
    }
    return getUserBookmarks(userId, tx);
  });
}
