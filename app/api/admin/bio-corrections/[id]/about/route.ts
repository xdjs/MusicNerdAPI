import { getCorrectionAboutHandler } from "@/lib/bioCorrections/getCorrectionAboutHandler";
import { putCorrectionAboutHandler } from "@/lib/bioCorrections/putCorrectionAboutHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * GET /api/admin/bio-corrections/{id}/about — the About a report is about. Admin only.
 *
 * @param request - The incoming request.
 * @param context - Route context.
 * @param context.params - The report id.
 * @returns `{ status, bio, revision }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getCorrectionAboutHandler(request, (await context.params).id);
}

/**
 * PUT /api/admin/bio-corrections/{id}/about — save the corrected About and resolve. Admin only.
 *
 * @param request - Body `{ bio, revision }`.
 * @param context - Route context.
 * @param context.params - The report id.
 * @returns `{ status: "ok" }`, or an error.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return putCorrectionAboutHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
