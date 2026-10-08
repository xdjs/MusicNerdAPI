import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getQuestionResearchHandler } from "@/lib/questionResearch/getQuestionResearchHandler";
/**
 * Read sanitized durable research progress and currently eligible original references.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and optional resource identifiers.
 * @returns Bounded JSON result or a safe error response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;
  return getQuestionResearchHandler(request, id, jobId);
}
/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
