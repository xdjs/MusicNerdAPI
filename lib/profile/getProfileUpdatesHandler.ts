import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

const BATCH = 6;
const UPDATE_KINDS: Record<string, true> = { All: true, Links: true, Sources: true, Lore: true };

/**
 * GET /api/profile/updates — paginated activity feed across the
 * authenticated user's contributed artists.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ items, total, next, unavailable, unavailableProviders }`.
 */
export async function getProfileUpdatesHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (request.headers.get("X-Profile-Account") !== auth.userId) {
    return NextResponse.json(
      { status: "error", error: "Account changed. Refresh and try again." },
      { status: 409, headers: getCorsHeaders() },
    );
  }

  const params = new URL(request.url).searchParams;
  const rawOffset = params.get("offset") ?? "0";
  if (!/^\d{1,6}$/.test(rawOffset)) {
    return NextResponse.json(
      { status: "error", error: "Invalid offset" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const offset = Number(rawOffset);
  const filter = params.get("kind") ?? "All";
  if (!UPDATE_KINDS[filter]) {
    return NextResponse.json(
      { status: "error", error: "Invalid filter" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const artistRows = await db.execute(sql`
    SELECT a.id, a.name
    FROM artists a
    WHERE (
      a.added_by = ${auth.userId}::uuid
      OR EXISTS (SELECT 1 FROM ugcresearch u WHERE u.artist_id = a.id AND u.user_id = ${auth.userId}::uuid AND u.accepted = true)
      OR EXISTS (SELECT 1 FROM artist_self_edits e WHERE e.artist_id = a.id AND e.user_id = ${auth.userId}::uuid)
    )
    ORDER BY lower(a.name), a.id
    LIMIT ${BATCH} OFFSET ${offset}
  `);
  const totalRows = await db.execute(sql`
    SELECT count(*)::int AS total FROM artists a
    WHERE (
      a.added_by = ${auth.userId}::uuid
      OR EXISTS (SELECT 1 FROM ugcresearch u WHERE u.artist_id = a.id AND u.user_id = ${auth.userId}::uuid AND u.accepted = true)
      OR EXISTS (SELECT 1 FROM artist_self_edits e WHERE e.artist_id = a.id AND e.user_id = ${auth.userId}::uuid)
    )
  `);
  const total = (totalRows[0] as { total: number })?.total ?? 0;

  const items: Array<Record<string, unknown>> = [];
  for (const row of artistRows as unknown as Array<{ id: string; name: string | null }>) {
    const events = await db.execute(sql`
      SELECT e.id, e.action, e.trigger, e.created_at AS "createdAt",
             v.url, v.title
      FROM artist_activity_events e
      LEFT JOIN artist_vault_sources v ON v.id = e.source_id
      WHERE e.artist_id = ${row.id}::uuid
      ORDER BY e.created_at DESC LIMIT 2
    `);
    for (const ev of events as Array<Record<string, unknown>>) {
      items.push({
        ...ev,
        id: `${row.id}:${ev.id}`,
        artistId: row.id,
        artistName: row.name ?? "Unknown artist",
      });
    }
  }

  const next = offset + (artistRows as unknown[]).length;

  return NextResponse.json(
    {
      items,
      total,
      next: next < total ? next : null,
      unavailable: false,
      unavailableProviders: [],
    },
    { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
  );
}
