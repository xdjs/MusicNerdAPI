import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getOnboardingStateHandler } from "@/lib/onboarding/getOnboardingStateHandler";

export const dynamic = "force-dynamic";

/**
 * CORS preflight: MusicNerdWeb polls this from the browser, on another origin.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Where an artist's onboarding build is: each step's confirmation time, whether
 * it's complete, and the current step. Public, uncached; the profile page polls
 * it while the build runs.
 *
 * @param _request - The request.
 * @param context - The route context.
 * @param context.params - Holds the `artistId`.
 * @returns 200 with `{ status, complete, currentStep, steps }`, 400 for a bad id, or 503 when the state can't be read.
 */
export async function GET(_request: Request, context: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await context.params;
  return getOnboardingStateHandler(artistId);
}
