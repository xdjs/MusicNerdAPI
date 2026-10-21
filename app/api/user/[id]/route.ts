import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserHandler } from "@/lib/users/getUserHandler";
import { patchUserHandler } from "@/lib/users/patchUserHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The caller's own user row.
 *
 * @param request - The request; a Privy token for the account `id`.
 * @param context - The route context.
 * @param context.params - Holds the account `id`.
 * @returns 200 with the row, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getUserHandler(request, id);
}

/**
 * Saves the caller's chosen user name.
 *
 * @param request - The request: a Privy token for the account `id` and `{ username }`.
 * @param context - The route context.
 * @param context.params - Holds the account `id`.
 * @returns 200 with `{ status, message }`, or an error.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return patchUserHandler(request, id);
}
