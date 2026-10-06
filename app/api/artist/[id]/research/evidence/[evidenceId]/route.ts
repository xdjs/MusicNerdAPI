import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchEvidenceHandler } from "@/lib/questionResearch/getResearchEvidenceHandler";
/**
 * Reopen immutable discovery evidence under current source and caller eligibility.
 *
 * @param request - Authenticated request.
 * @param context - Route context.
 * @param context.params - Artist and optional resource identifiers.
 * @returns Bounded JSON result or a safe error response.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const { id, evidenceId } = await context.params;
  return getResearchEvidenceHandler(request, id, evidenceId);
}
/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
