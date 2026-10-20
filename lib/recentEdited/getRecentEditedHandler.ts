import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { authenticateRequest } from "@/lib/auth/authenticateRequest";
import { db } from "@/lib/db/db";
import { ugcresearch, artists } from "@/lib/db/schema";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/recentEdited — the last 3 unique artists the user
 * submitted approved UGC for.
 *
 * @param request - Authenticated request.
 * @returns 200 with an array of recently edited artist entries.
 */
export async function getRecentEditedHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      id: ugcresearch.id,
      artistId: ugcresearch.artistId,
      siteName: ugcresearch.siteName,
      ugcUrl: ugcresearch.ugcUrl,
      createdAt: ugcresearch.createdAt,
      artistName: artists.name,
      customImage: artists.customImage,
    })
    .from(ugcresearch)
    .leftJoin(artists, eq(ugcresearch.artistId, artists.id))
    .where(and(eq(ugcresearch.userId, auth.userId), eq(ugcresearch.accepted, true)))
    .orderBy(desc(ugcresearch.createdAt))
    .limit(20);

  const seen = new Set<string>();
  const unique: typeof rows = [];
  for (const row of rows) {
    if (!row.artistId || seen.has(row.artistId)) continue;
    seen.add(row.artistId);
    unique.push(row);
    if (unique.length >= 3) break;
  }

  return NextResponse.json(unique, { status: 200, headers: getCorsHeaders() });
}
