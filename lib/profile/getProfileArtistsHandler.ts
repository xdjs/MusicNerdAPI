import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

const PAGE_SIZE = 24;

/**
 * GET /api/profile/artists — paginated list of artists the authenticated
 * user has contributed to (added, UGC-approved, or self-edited).
 *
 * @param request - The incoming request.
 * @returns 200 with `{ userId, artists, total, next }`.
 */
export async function getProfileArtistsHandler(request: Request): Promise<NextResponse> {
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
  const query = (params.get("q") ?? "").trim();
  if (!/^\d{1,6}$/.test(rawOffset) || query.length > 200) {
    return NextResponse.json(
      { status: "error", error: "Invalid artist search" },
      { status: 400, headers: getCorsHeaders() },
    );
  }
  const offset = Number(rawOffset);
  const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
  const likePat = `%${escapedQuery}%`;

  const eligibleCte = sql`
    SELECT a.id, a.name, a.custom_image
    FROM artists a
    WHERE (
      a.added_by = ${auth.userId}::uuid
      OR EXISTS (SELECT 1 FROM ugcresearch u WHERE u.artist_id = a.id AND u.user_id = ${auth.userId}::uuid AND u.accepted = true)
      OR EXISTS (SELECT 1 FROM artist_self_edits e WHERE e.artist_id = a.id AND e.user_id = ${auth.userId}::uuid)
    )
  `;
  const withNameFilter = query ? sql`${eligibleCte} AND a.name ILIKE ${likePat}` : eligibleCte;

  const [rows, totals] = await Promise.all([
    db.execute(
      sql`${withNameFilter} ORDER BY lower(a.name), a.id LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    ),
    db.execute(sql`SELECT count(*)::int AS total FROM (${withNameFilter}) sub`),
  ]);

  const total = (totals[0] as { total: number })?.total ?? 0;
  const artists = (
    rows as Array<{ id: string; name: string | null; custom_image: string | null }>
  ).map(a => ({
    artistId: a.id,
    artistName: a.name ?? "Unknown artist",
    imageUrl: a.custom_image,
  }));
  const next = offset + artists.length;

  return NextResponse.json(
    { userId: auth.userId, artists, total, next: next < total ? next : null },
    { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
  );
}
