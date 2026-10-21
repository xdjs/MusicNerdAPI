import { eq } from "drizzle-orm";
import { existingBookmarks } from "@/lib/account/existingBookmarks";
import type { Transaction } from "@/lib/account/types";
import { writeBookmarkOrder } from "@/lib/account/writeBookmarkOrder";
import { userArtistBookmarks } from "@/lib/db/schema";

/**
 * Moves the placeholder account's bookmarks to the legacy account. Called
 * inside the account merge after both user rows are locked. Keeps the legacy
 * account's saved positions and creation times; appends only missing entries.
 *
 * @param tx - The open transaction.
 * @param currentUserId - The placeholder account being merged away.
 * @param legacyUserId - The surviving account.
 * @returns Nothing.
 */
export async function transferUserBookmarks(
  tx: Transaction,
  currentUserId: string,
  legacyUserId: string,
): Promise<void> {
  const target = await existingBookmarks(tx, legacyUserId);
  const source = await tx
    .select({
      artistId: userArtistBookmarks.artistId,
      createdAt: userArtistBookmarks.createdAt,
      removedAt: userArtistBookmarks.removedAt,
    })
    .from(userArtistBookmarks)
    .where(eq(userArtistBookmarks.userId, currentUserId));
  const targetIds = new Set(target.map(({ artistId }) => artistId));
  const additions = source.filter(({ artistId }) => !targetIds.has(artistId));
  if (!additions.length) return;
  await tx
    .insert(userArtistBookmarks)
    .values(
      additions.map(({ artistId, createdAt, removedAt }, index) => ({
        userId: legacyUserId,
        artistId,
        createdAt,
        removedAt,
        position: target.length + index,
      })),
    )
    .onConflictDoNothing({ target: [userArtistBookmarks.userId, userArtistBookmarks.artistId] });
  await writeBookmarkOrder(tx, legacyUserId, [
    ...target.map(({ artistId }) => artistId),
    ...additions.map(({ artistId }) => artistId),
  ]);
}
