import { NextResponse } from "next/server";
import { postRevokeBoardKeyHandler } from "@/lib/board/postRevokeBoardKeyHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

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
 * Revokes one of the signed-in team member's agent keys.
 *
 * @param request - The request; a team member's Privy access token.
 * @param context - The route context.
 * @param context.params - Holds the key `id`.
 * @returns 200 with `{ status, message }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postRevokeBoardKeyHandler(request, id);
}
