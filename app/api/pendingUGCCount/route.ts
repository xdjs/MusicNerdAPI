import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPendingUGCCountHandler } from "@/lib/pendingUGCCount/getPendingUGCCountHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/pendingUGCCount — link submissions awaiting review. Admin only.
 *
 * @param request - The incoming request.
 * @returns `{ status, count }`, or an error.
 */
export async function GET(request: Request) {
  return getPendingUGCCountHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
