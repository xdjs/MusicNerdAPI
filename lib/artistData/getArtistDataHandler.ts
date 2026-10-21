import { NextResponse } from "next/server";
import { ARTIST_DATA_CACHE_TTL_MS } from "@/lib/artistData/const";
import { getArtistDataSummary } from "@/lib/artistData/getArtistDataSummary";
import type { ArtistDataSummary } from "@/lib/artistData/types";
import { authenticateAdmin } from "@/lib/auth/authenticateAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

// In-memory cache with 30s TTL + promise reuse to prevent concurrent DB hits
let cached: { data: ArtistDataSummary; timestamp: number } | null = null;
let inflight: Promise<ArtistDataSummary> | null = null;

/**
 * Handles GET /api/admin/artist-data: the catalog summary, reused for 30
 * seconds per server instance, with one database read shared by concurrent
 * callers (MusicNerdWeb's route behaviour).
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with the summary and `status: "ok"`; 401, 403 or 500 with `{ status: "error", error }`.
 */
export async function getArtistDataHandler(request: Request): Promise<NextResponse> {
  const headers = getCorsHeaders();
  try {
    const auth = await authenticateAdmin(request);
    if (auth instanceof NextResponse) return auth;

    if (cached && Date.now() - cached.timestamp < ARTIST_DATA_CACHE_TTL_MS)
      return NextResponse.json({ status: "ok", ...cached.data }, { status: 200, headers });

    if (!inflight) {
      inflight = getArtistDataSummary().finally(() => {
        inflight = null;
      });
    }
    const data = await inflight;
    cached = { data, timestamp: Date.now() };
    return NextResponse.json({ status: "ok", ...data }, { status: 200, headers });
  } catch (e) {
    console.error("[artist-data] GET error", e);
    return NextResponse.json(
      { status: "error", error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
