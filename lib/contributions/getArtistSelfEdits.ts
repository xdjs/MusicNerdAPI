import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artists, artistSelfEdits } from "@/lib/db/schema";

/**
 * One page of a user's edits to their own artist profile, newest first, with
 * the artist's name. A page past the end is clamped to the last page.
 * MusicNerdWeb's `getArtistSelfEdits`, verbatim.
 *
 * @param userId - The authenticated user; never from the request.
 * @param requestedPage - The page asked for, from 1.
 * @returns The page's entries, the total, the page served and the page count.
 */
export async function getArtistSelfEdits(userId: string, requestedPage = 1) {
  const pageSize = 10;
  const where = eq(artistSelfEdits.userId, userId);
  const [{ total }] = await db.select({ total: count() }).from(artistSelfEdits).where(where);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, requestedPage));
  const entries = await db
    .select({
      id: artistSelfEdits.id,
      artistId: artistSelfEdits.artistId,
      artistName: artists.name,
      siteName: artistSelfEdits.siteName,
      oldValue: artistSelfEdits.oldValue,
      newValue: artistSelfEdits.newValue,
      createdAt: artistSelfEdits.createdAt,
    })
    .from(artistSelfEdits)
    .innerJoin(artists, eq(artists.id, artistSelfEdits.artistId))
    .where(where)
    .orderBy(desc(artistSelfEdits.createdAt), desc(artistSelfEdits.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { entries, total, page, pageCount };
}
