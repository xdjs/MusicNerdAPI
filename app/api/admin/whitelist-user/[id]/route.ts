import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { putWhitelistUserHandler } from "@/lib/users/putWhitelistUserHandler";

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
 * Updates a user's wallet, email, user name or role flags.
 *
 * @param request - The request; an admin's Privy token and the fields to change.
 * @param context - The route context.
 * @param context.params - Holds the user `id`.
 * @returns 200 with `{ status, message }`, or an error.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return putWhitelistUserHandler(request, id);
}
