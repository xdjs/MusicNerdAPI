import { NextResponse } from "next/server";
import { ARTIST_DATA_CACHE_TTL_MS } from "@/lib/artistData/const";
import { getArtistDataSummary } from "@/lib/artistData/getArtistDataSummary";
import type { ArtistDataSummary } from "@/lib/artistData/types";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

// Per warm instance: a 30s cache, and one shared in-flight read so concurrent
// admins don't each scan the artists table.
let cached: { data: ArtistDataSummary; at: number } | null = null;
let inflight: Promise<ArtistDataSummary> | null = null;

/**
 * Handles GET /api/admin/artist-data: artist coverage and completeness stats.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ status, ...summary }`, 401/403, or 500.
 */
export async function getArtistDataHandler(request: Request): Promise<NextResponse> {
  const auth = await authenticateAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const headers = getCorsHeaders();
  try {
    if (!cached || Date.now() - cached.at >= ARTIST_DATA_CACHE_TTL_MS) {
      inflight ??= getArtistDataSummary().finally(() => {
        inflight = null;
      });
      cached = { data: await inflight, at: Date.now() };
    }
    return NextResponse.json({ status: "ok", ...cached.data }, { headers });
  } catch (e) {
    console.error("[artist-data] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
