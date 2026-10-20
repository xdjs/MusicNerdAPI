import { patchBioCorrectionHandler } from "@/lib/bioCorrections/patchBioCorrectionHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * PATCH /api/admin/bio-corrections/{id} — resolve or dismiss a report. Admin only.
 *
 * @param request - Body `{ status: "resolved" | "dismissed" }`.
 * @param context - Route context.
 * @param context.params - The report id.
 * @returns `{ status: "ok" }`, or an error.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return patchBioCorrectionHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
