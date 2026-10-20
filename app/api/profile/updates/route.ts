import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileUpdatesHandler } from "@/lib/profile/getProfileUpdatesHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/profile/updates — paginated activity feed.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ items, total, next, unavailable, unavailableProviders }`.
 */
export async function GET(request: Request) {
  return getProfileUpdatesHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
