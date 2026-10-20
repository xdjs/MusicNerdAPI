import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { putWhitelistUserHandler } from "@/lib/whitelistUser/putWhitelistUserHandler";

/**
 * PUT /api/admin/whitelist-user/{id} — edit a user's wallet, email, name or roles. Admin only.
 *
 * @param request - Body with any of `wallet`, `email`, `username`, `isAdmin`, `isWhiteListed`, `isHidden`.
 * @param context - Route context.
 * @param context.params - The user id.
 * @returns `{ status, message }`, or an error.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return putWhitelistUserHandler(request, (await context.params).id);
}

/**
 * CORS preflight.
 *
 * @returns Empty CORS response.
 */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}
