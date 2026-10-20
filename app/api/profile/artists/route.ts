import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileArtistsHandler } from "@/lib/profile/getProfileArtistsHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/artists — paginated contributed artists.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ userId, artists, total, next }`.
 */
export async function GET(request: Request) {
  return getProfileArtistsHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
