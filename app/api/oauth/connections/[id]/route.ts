import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteConnectionHandler } from "@/lib/oauth/deleteConnectionHandler";

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
 * Disconnects one of the signed-in user's agents.
 *
 * @param request - The request; a Privy access token.
 * @param context - The route context.
 * @param context.params - Holds the connection `id`.
 * @returns 200 `{ status }`; 401 or 500.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return deleteConnectionHandler(request, id);
}
