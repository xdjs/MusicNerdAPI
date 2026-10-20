import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postBioCorrectionsHandler } from "@/lib/bioCorrections/postBioCorrectionsHandler";

export const dynamic = "force-dynamic";

/**
 * Submit a correction to an artist's bio.
 *
 * @param request - The authenticated request.
 * @param context - Route context.
 * @param context.params - Artist identifier.
 * @returns The correction result or a safe error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postBioCorrectionsHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty preflight response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
