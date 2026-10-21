import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists, ugcresearch } from "@/lib/db/schema";

/** One of a user's recently edited artists, from their latest approved submission. */
export type RecentEditedRow = {
  ugcId: string;
  artistId: string | null;
  updatedAt: string | null;
  artistName: string | null;
  spotifyId: string | null;
  deezerId: string | null;
  customImage: string | null;
};

/**
 * The last three distinct artists a user's approved submissions touched:
 * their 20 most recently updated approved submissions, deduplicated by artist.
 * MusicNerdWeb's `/api/recentEdited` query.
 *
 * @param userId - The user.
 * @returns Up to three rows, most recently edited first.
 */
export async function listRecentEdited(userId: string): Promise<RecentEditedRow[]> {
  const rows = await db
    .select({
      ugcId: ugcresearch.id,
      artistId: ugcresearch.artistId,
      updatedAt: ugcresearch.updatedAt,
      artistName: artists.name,
      spotifyId: artists.spotify,
      deezerId: artists.deezer,
      customImage: artists.customImage,
    })
    .from(ugcresearch)
    .leftJoin(artists, eq(artists.id, ugcresearch.artistId))
    .where(and(eq(ugcresearch.userId, userId), eq(ugcresearch.accepted, true)))
    .orderBy(desc(ugcresearch.updatedAt))
    .limit(20);

  const unique: Record<string, RecentEditedRow> = {};
  for (const row of rows) {
    if (row.artistId && !unique[row.artistId]) {
      unique[row.artistId] = row;
    }
    if (Object.keys(unique).length === 3) break;
  }
  return Object.values(unique);
}
