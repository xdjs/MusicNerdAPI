import { and, eq, inArray, sql } from "drizzle-orm";
import type { Transaction } from "@/lib/account/types";
import { userArtistBookmarks } from "@/lib/db/schema";

/**
 * Writes each listed artist's position as its index in the list, in one
 * statement. Unlisted bookmarks keep their position.
 *
 * @param tx - The open transaction.
 * @param userId - The account.
 * @param artistIds - The artists, first to last.
 * @returns Nothing.
 */
export async function writeBookmarkOrder(
  tx: Transaction,
  userId: string,
  artistIds: string[],
): Promise<void> {
  if (!artistIds.length) return;
  const positions = sql.join(
    artistIds.map((id, index) => sql`WHEN ${id}::uuid THEN ${index}::integer`),
    sql` `,
  );
  await tx
    .update(userArtistBookmarks)
    .set({
      position: sql`CASE ${userArtistBookmarks.artistId} ${positions} ELSE ${userArtistBookmarks.position} END`,
    })
    .where(
      and(eq(userArtistBookmarks.userId, userId), inArray(userArtistBookmarks.artistId, artistIds)),
    );
}
