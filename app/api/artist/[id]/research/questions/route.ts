import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postQuestionResearchHandler } from "@/lib/questionResearch/postQuestionResearchHandler";
/**
 * Queue bounded question-directed public research; claimant/admin or server research credential required.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and optional resource identifiers.
 * @returns Bounded JSON result or a safe error response.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postQuestionResearchHandler(request, id);
}
/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
