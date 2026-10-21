import { NextResponse } from "next/server";
import { handleArtistInterview } from "@/lib/interview/handleArtistInterview";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Restores only saved interview state, with the active sitting's preparation.
 * The website's interview read; requires the claimant's or an admin's Privy token.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>`.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with the saved interview, or an error.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleArtistInterview(request, id);
}

/**
 * Runs one explicit artist interview action (`start`, `continue`, `prepare`,
 * `answer`, `finish`, `boundary`, `retract`, `memory`, `boundaries`, `source`);
 * question generation reads and persists through the research worker, never
 * in this request.
 *
 * @param request - The request, carrying `Authorization: Bearer <Privy access token>` and the action body.
 * @param context - The route context.
 * @param context.params - Holds the artist `id`.
 * @returns 200 with the action's result, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleArtistInterview(request, id);
}
