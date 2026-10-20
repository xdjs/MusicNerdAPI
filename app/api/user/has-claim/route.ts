import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getHasClaimHandler } from "@/lib/user/getHasClaimHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/has-claim — check for an approved artist claim.
 *
 * @param request - The incoming request.
 * @returns 200 with `{ hasClaim }`.
 */
export async function GET(request: Request) {
  return getHasClaimHandler(request);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
