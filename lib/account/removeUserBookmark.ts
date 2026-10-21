import { editUserBookmarks } from "@/lib/account/editUserBookmarks";
import type { BookmarkItem } from "@/lib/account/types";

/**
 * Removes one artist from the user's bookmarks.
 *
 * @param userId - The account.
 * @param artistId - The artist to remove.
 * @returns The whole list after the removal.
 */
export async function removeUserBookmark(
  userId: string,
  artistId: string,
): Promise<BookmarkItem[]> {
  return editUserBookmarks(userId, [], [artistId]);
}
