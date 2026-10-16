import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postContinueQuestionResearchHandler } from "@/lib/questionResearch/postContinueQuestionResearchHandler";
/**
 * Continue the same admitted research job after an insufficient candidate answer attempt.
 *
 * @param request - Authenticated service request without routing overrides.
 * @param context - Route context.
 * @param context.params - Artist and job identifiers.
 * @returns Current bounded job status or a safe error response.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id, jobId } = await context.params;
  return postContinueQuestionResearchHandler(request, id, jobId);
}
/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
