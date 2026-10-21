import { NextResponse } from "next/server";
import { postLoreSuggestionHandler } from "@/lib/loreSuggestions/postLoreSuggestionHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight.
 *
 * @returns 204 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * Adds a signed-in account's suggested web page to the artist's vault: approved
 * at once for a trusted contributor, pending review for anyone else.
 *
 * @param request - The request; a Privy token and `{ url }`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 201 with `{ status, success, sourceStatus, warning? }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postLoreSuggestionHandler(request, id);
}
