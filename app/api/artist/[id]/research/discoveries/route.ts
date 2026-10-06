import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchDiscoveriesHandler } from "@/lib/questionResearch/getResearchDiscoveriesHandler";
/**
 * List pending discoveries for the current artist claimant or administrator.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and optional resource identifiers.
 * @returns Bounded JSON result or a safe error response.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getResearchDiscoveriesHandler(request, id);
}
/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
