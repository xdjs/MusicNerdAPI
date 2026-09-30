import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postResearchRefreshHandler } from "@/lib/research/postResearchRefreshHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight: MusicNerdWeb calls this from the browser, on another origin.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * "Look again" for an artist: rebuild the Lore and read the artist's recent
 * posts. The claimant or an admin, signed in with a Privy access token
 * (`Authorization: Bearer`).
 *
 * @param request - The request.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns `{ status: "ok", message }`, or an error with 400, 401, 403 or 500.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return postResearchRefreshHandler(request, id);
}
