import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserHandler } from "@/lib/user/getUserHandler";
import { patchUserHandler } from "@/lib/user/patchUserHandler";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/:id — fetch the authenticated user's profile.
 *
 * @param request - The incoming request.
 * @param context - Route context.
 * @param context.params - Promise resolving to `{ id }`.
 * @returns 200 with user profile data.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getUserHandler(request, (await context.params).id);
}

/**
 * PATCH /api/user/:id — update the authenticated user's username.
 *
 * @param request - The incoming request with new username.
 * @param context - Route context.
 * @param context.params - Promise resolving to `{ id }`.
 * @returns 200 on success.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return patchUserHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns 204 with CORS headers.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
