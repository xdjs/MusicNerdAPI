import { inArray, sql } from "drizzle-orm";
import { isRealBio } from "@/lib/bio/isRealBio";
import { db } from "@/lib/db/db";
import { artists } from "@/lib/db/schema";

/**
 * The About of each artist, only when the artist has an approved claim and the
 * About is real (not the claim nudge); otherwise null. Unknown ids are skipped.
 *
 * @param ids - Artist ids.
 * @returns One `{ id, bio }` per known artist.
 */
export async function getArtistSummaries(ids: string[]) {
  const rows = await db
    .select({
      id: artists.id,
      // Qualified by table: an unqualified "id" here would bind to artist_claims.id
      // (MusicNerdWeb's version did, so it never returned a bio).
      bio: sql<
        string | null
      >`case when exists(select 1 from artist_claims c where c.artist_id = ${artists}.id and c.status = 'approved') then ${artists.bio} else null end`,
    })
    .from(artists)
    .where(inArray(artists.id, ids));
  return rows.map(row => ({ id: row.id, bio: row.bio && isRealBio(row.bio) ? row.bio : null }));
}
