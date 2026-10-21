import { NextResponse } from "next/server";
import { handleLatestRefresh } from "@/lib/latest/handleLatestRefresh";
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
 * Reads the artist's Update Latest request still in scope; nothing is queued.
 * The claimant or an admin, by Privy token.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, refresh }`, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleLatestRefresh(request, id, false);
}

/**
 * Queues an Update Latest check for the research worker from the artist's
 * current connections, then reads it back. The claimant or an admin, by Privy
 * token.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with `{ status, refresh }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleLatestRefresh(request, id, true);
}
