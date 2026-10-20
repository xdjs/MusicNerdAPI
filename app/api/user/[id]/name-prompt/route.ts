import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postNamePromptHandler } from "@/lib/user/postNamePromptHandler";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/:id/name-prompt — mark the username prompt as shown.
 *
 * @param request - The incoming request.
 * @param context - Route context.
 * @param context.params - Promise resolving to `{ id }`.
 * @returns 200 on success.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return postNamePromptHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
