import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { isRealBio } from "@/lib/bio/isRealBio";
import { db } from "@/lib/db/db";

/**
 * GET /api/profile/artist-summaries — returns bios for claimed artists
 * identified by their IDs.
 *
 * @param request - The incoming request.
 * @returns 200 with array of `{ id, bio }`.
 */
export async function getArtistSummariesHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const ids = [...new Set(new URL(request.url).searchParams.getAll("id"))];
  if (
    !ids.length ||
    ids.length > 6 ||
    ids.some(id => !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
  ) {
    return NextResponse.json(
      { status: "error", error: "Provide up to six artist IDs" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const placeholders = ids.map(id => sql`${id}::uuid`);
  const rows = await db.execute(sql`
    SELECT a.id,
           CASE WHEN EXISTS (
             SELECT 1 FROM artist_claims c
             WHERE c.artist_id = a.id AND c.status = 'approved'
           ) THEN a.bio ELSE NULL END AS bio
    FROM artists a
    WHERE a.id IN (${sql.join(placeholders, sql`, `)})
  `);

  const result = (rows as Array<{ id: string; bio: string | null }>).map(row => ({
    id: row.id,
    bio: row.bio && isRealBio(row.bio) ? row.bio : null,
  }));

  return NextResponse.json(result, {
    headers: { ...getCorsHeaders(), "Cache-Control": "private, no-store" },
  });
}
