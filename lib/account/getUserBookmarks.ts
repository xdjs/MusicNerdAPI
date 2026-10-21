import { and, asc, eq, isNull } from "drizzle-orm";
import { storedImage } from "@/lib/account/storedImage";
import type { BookmarkItem, ReadDatabase } from "@/lib/account/types";
import { db } from "@/lib/db/db";
import { artists, userArtistBookmarks } from "@/lib/db/schema";

/**
 * The user's bookmarks in saved order. No catalog requests: names and images
 * are joined from the current artist row.
 *
 * @param userId - The account.
 * @param database - The database, or the open transaction to read inside.
 * @returns The bookmarks, first to last.
 */
export async function getUserBookmarks(
  userId: string,
  database: ReadDatabase = db,
): Promise<BookmarkItem[]> {
  const rows = await database
    .select({
      artistId: userArtistBookmarks.artistId,
      artistName: artists.name,
      imageUrl: artists.customImage,
      deezer: artists.deezer,
    })
    .from(userArtistBookmarks)
    .innerJoin(artists, eq(artists.id, userArtistBookmarks.artistId))
    .where(and(eq(userArtistBookmarks.userId, userId), isNull(userArtistBookmarks.removedAt)))
    .orderBy(
      asc(userArtistBookmarks.position),
      asc(userArtistBookmarks.createdAt),
      asc(userArtistBookmarks.artistId),
    );
  return rows.map(({ deezer, ...row }) => ({
    ...row,
    artistName: row.artistName ?? "Unknown Artist",
    imageUrl:
      storedImage(row.imageUrl) ??
      (deezer && /^[1-9]\d*$/.test(deezer)
        ? `https://api.deezer.com/artist/${deezer}/image?size=medium`
        : null),
  }));
}
