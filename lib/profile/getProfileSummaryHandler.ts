import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { db } from "@/lib/db/db";

/**
 * GET /api/profile/summary — contribution summary stats for the
 * authenticated user.
 *
 * @param request - The incoming request.
 * @returns 200 with contribution stats.
 */
export async function getProfileSummaryHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  if (request.headers.get("X-Profile-Account") !== auth.userId) {
    return NextResponse.json(
      { status: "error", error: "Account changed. Refresh and try again." },
      { status: 409, headers: getCorsHeaders() },
    );
  }

  const [stats, entries, addedCount, editCount] = await Promise.all([
    db.execute(sql`
      SELECT count(*)::int AS "totalContributions",
             count(*) FILTER (WHERE accepted = true)::int AS approved,
             count(*) FILTER (WHERE accepted = false)::int AS pending
      FROM ugcresearch WHERE user_id = ${auth.userId}::uuid
    `),
    db.execute(sql`
      SELECT u.id, a.id AS "artistId", a.name AS "artistName", a.custom_image AS "imageUrl",
             u.site_name AS "siteName", u.ugc_url AS "ugcUrl", u.accepted, u.created_at AS "createdAt"
      FROM ugcresearch u LEFT JOIN artists a ON a.id = u.artist_id
      WHERE u.user_id = ${auth.userId}::uuid
      ORDER BY u.created_at DESC, u.id DESC LIMIT 3
    `),
    db.execute(
      sql`SELECT count(*)::int AS total FROM artists WHERE added_by = ${auth.userId}::uuid`,
    ),
    db.execute(
      sql`SELECT count(*)::int AS total FROM artist_self_edits WHERE user_id = ${auth.userId}::uuid`,
    ),
  ]);

  const s = stats[0] as
    { totalContributions: number; approved: number; pending: number } | undefined;

  return NextResponse.json(
    {
      userId: auth.userId,
      totalContributions: s?.totalContributions ?? 0,
      selfEdits: (editCount[0] as { total: number })?.total ?? 0,
      artistsAdded: (addedCount[0] as { total: number })?.total ?? 0,
      approved: s?.approved ?? 0,
      pending: s?.pending ?? 0,
      entries,
    },
    { headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" } },
  );
}
