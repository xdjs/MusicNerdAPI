import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postOnboardingChatHandler } from "@/lib/onboarding/postOnboardingChatHandler";

export const dynamic = "force-dynamic";
// One POST is one chat turn. The route stops streaming at 55 s so it closes before this.
export const maxDuration = 60;

/**
 * CORS preflight: MusicNerdWeb calls this from the browser, on another origin.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * One onboarding chat turn for an artist, streamed as server-sent events: the
 * auto-build on a fresh claim, or the step-by-step cards. The claimant or an
 * admin, signed in with a Privy access token (`Authorization: Bearer`).
 *
 * @param request - The request; the body is the turn (`{ type: "open" }`, …).
 * @param context - The route context.
 * @param context.params - Holds the `artistId`.
 * @returns A `text/event-stream` of turn events, or an error with 400, 401 or 403.
 */
export async function POST(request: Request, context: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await context.params;
  return postOnboardingChatHandler(request, artistId);
}
