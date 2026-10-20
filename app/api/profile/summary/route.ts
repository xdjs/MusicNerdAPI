import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileSummaryHandler } from "@/lib/profile/getProfileSummaryHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/summary — contribution stats for the authenticated user.
 *
 * @param request - The incoming request.
 * @returns 200 with UGC stats and recent entries.
 */
export async function GET(request: Request) {
  return getProfileSummaryHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
