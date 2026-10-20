import { getArtistDataHandler } from "@/lib/artistData/getArtistDataHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/artist-data — artist coverage and completeness stats. Admin only.
 *
 * @param request - The incoming request.
 * @returns The Artist Data summary.
 */
export async function GET(request: Request) {
  return getArtistDataHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
