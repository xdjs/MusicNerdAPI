import { and, asc, count, eq, exists, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { likePattern } from "@/lib/db/likePattern";
import { artists, artistSelfEdits, ugcresearch } from "@/lib/db/schema";

/**
 * The artists a user contributed to: added, had a link accepted on, or edited
 * as the claimant. Shared by the profile's artist collection and its updates
 * feed. Name order, case-insensitive, then id, so pages never overlap.
 *
 * @param userId - The user.
 * @param page - Where the page starts, how many to return, and an optional name search.
 * @param page.offset - Rows to skip.
 * @param page.limit - Rows to return.
 * @param page.query - A case-insensitive name search; pattern characters are literal.
 * @returns The page of artists (id, name, stored portrait) and the matching total.
 */
export async function getContributedArtists(
  userId: string,
  { offset, limit, query = "" }: { offset: number; limit: number; query?: string },
) {
  const eligible = or(
    eq(artists.addedBy, userId),
    exists(
      db
        .select({ id: ugcresearch.id })
        .from(ugcresearch)
        .where(
          and(
            eq(ugcresearch.artistId, artists.id),
            eq(ugcresearch.userId, userId),
            eq(ugcresearch.accepted, true),
          ),
        ),
    ),
    exists(
      db
        .select({ id: artistSelfEdits.id })
        .from(artistSelfEdits)
        .where(and(eq(artistSelfEdits.artistId, artists.id), eq(artistSelfEdits.userId, userId))),
    ),
  );
  const condition = and(eligible, query ? ilike(artists.name, likePattern(query)) : undefined);
  const [rows, totals] = await Promise.all([
    db
      .select({ id: artists.id, name: artists.name, customImage: artists.customImage })
      .from(artists)
      .where(condition)
      .orderBy(asc(sql`lower(${artists.name})`), asc(artists.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(artists).where(condition),
  ]);
  return { artists: rows, total: totals[0]?.total ?? 0 };
}
