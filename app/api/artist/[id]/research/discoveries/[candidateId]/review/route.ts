import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchReviewHandler } from "@/lib/questionResearch/postResearchReviewHandler";
/**
 * Review an exact discovery revision and atomically promote or decline it under current artist authority.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and optional resource identifiers.
 * @returns Bounded JSON result or a safe error response.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; candidateId: string }> },
) {
  const { id, candidateId } = await context.params;
  return postResearchReviewHandler(request, id, candidateId);
}
/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
