import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { UserEntriesQuery } from "@/lib/contributions/validateUserEntriesQuery";
import { db } from "@/lib/db/db";
import { artists, ugcresearch } from "@/lib/db/schema";

const PER_PAGE = 10;

/**
 * One page of a user's submitted links with the artist each belongs to,
 * filtered by platform, approval status and an escaped case-insensitive
 * artist-name search; plus every platform they have submitted to, for the
 * filter menu. `all` returns every match as one page. MusicNerdWeb's
 * `/api/userEntries` queries, verbatim.
 *
 * @param userId - The authenticated user; never from the request.
 * @param query - The normalized query.
 * @returns The entries, the total matching, the page count and the user's platforms.
 */
export async function listUserEntries(userId: string, query: UserEntriesQuery) {
  let conditions: SQL = eq(ugcresearch.userId, userId);
  if (query.siteName) conditions = and(conditions, eq(ugcresearch.siteName, query.siteName))!;
  if (query.status)
    conditions = and(conditions, eq(ugcresearch.accepted, query.status === "approved"))!;
  if (query.query)
    conditions = and(
      conditions,
      ilike(artists.name, `%${query.query.replace(/[%_\\]/g, "\\$&")}%`),
    )!;

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(ugcresearch)
    .leftJoin(artists, eq(artists.id, ugcresearch.artistId))
    .where(conditions);
  const pageCount = query.all ? 1 : Math.ceil(total / PER_PAGE);
  const offset = query.all ? 0 : (query.page - 1) * PER_PAGE;

  const baseQuery = db
    .select({
      id: ugcresearch.id,
      createdAt: ugcresearch.createdAt,
      siteName: ugcresearch.siteName,
      ugcUrl: ugcresearch.ugcUrl,
      accepted: ugcresearch.accepted,
      artistName: artists.name,
      artistId: artists.id,
    })
    .from(ugcresearch)
    .leftJoin(artists, eq(artists.id, ugcresearch.artistId))
    .where(conditions)
    .orderBy(
      query.order === "oldest" ? asc(ugcresearch.createdAt) : desc(ugcresearch.createdAt),
      desc(ugcresearch.id),
    );
  const entries = query.all ? await baseQuery : await baseQuery.limit(PER_PAGE).offset(offset);

  const platforms = await db
    .selectDistinct({ siteName: ugcresearch.siteName })
    .from(ugcresearch)
    .where(eq(ugcresearch.userId, userId));
  return {
    entries,
    total,
    pageCount,
    platforms: platforms
      .map(row => row.siteName)
      .filter((siteName): siteName is string => Boolean(siteName)),
  };
}
