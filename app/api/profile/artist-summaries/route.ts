import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSummariesHandler } from "@/lib/profile/getArtistSummariesHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/artist-summaries — claimed artist bios by ID.
 *
 * @param request - The incoming request with `?id=` params.
 * @returns 200 with array of `{ id, bio }`.
 */
export async function GET(request: Request) {
  return getArtistSummariesHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
