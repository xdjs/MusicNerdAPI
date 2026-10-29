import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { ArtistActivityQuery } from "@/lib/adminActivity/types";
import { clampPage } from "@/lib/db/clampPage";
import { db } from "@/lib/db/db";
import { likePattern } from "@/lib/db/likePattern";
import { artistActivityEvents as events, artists, users } from "@/lib/db/schema";

const PAGE_SIZE = 25;

/**
 * The artist activity log for the admin page, newest first, 25 per page.
 * MusicNerdWeb's `getArtistActivity`, query for query; the caller checks the
 * admin role first.
 *
 * @param filters - A search, an action, one event, and the page.
 * @param filters.query - Matches the artist, or the actor's username, email or user id.
 * @param filters.action - Only this action; empty for every action.
 * @param filters.eventId - Only this event; empty for every event.
 * @param filters.page - The page wanted.
 * @returns One page of events with artist and actor, the total, and the filters.
 */
export async function getArtistActivity({ query, action, eventId, page }: ArtistActivityQuery) {
  const pattern = likePattern(query);
  const where = and(
    eventId ? eq(events.id, eventId) : undefined,
    action ? eq(events.action, action) : undefined,
    query
      ? or(
          ilike(artists.name, pattern),
          ilike(users.username, pattern),
          ilike(users.email, pattern),
          sql`${users.id}::text ilike ${pattern}`,
        )
      : undefined,
  );
  const [counts] = await db
    .select({ total: count() })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(users, eq(events.actorUserId, users.id))
    .where(where);
  const total = counts?.total ?? 0;
  const current = clampPage(page, total, PAGE_SIZE);
  const items = await db
    .select({
      id: events.id,
      artistId: events.artistId,
      artistName: artists.name,
      action: events.action,
      trigger: events.trigger,
      actorKind: events.actorKind,
      actorId: users.id,
      actorName: users.username,
      actorEmail: users.email,
      createdAt: events.createdAt,
      sourceId: events.sourceId,
    })
    .from(events)
    .innerJoin(artists, eq(events.artistId, artists.id))
    .leftJoin(users, eq(events.actorUserId, users.id))
    .where(where)
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);
  return { items, total, page: current, pageSize: PAGE_SIZE, filters: { query, action, eventId } };
}
