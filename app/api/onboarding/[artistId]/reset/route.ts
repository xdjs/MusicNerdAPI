import { NextResponse } from "next/server";
import { postResetClaimBuildHandler } from "@/lib/claimBuild/postResetClaimBuildHandler";
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
 * Resets a claimed artist's page build: removes everything the build wrote and
 * returns the removed values.
 *
 * @param request - The request; a claimant or admin Privy token.
 * @param context - The route context.
 * @param context.params - Holds the `artistId`.
 * @returns 200 with `{ status, removed }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await context.params;
  return postResetClaimBuildHandler(request, artistId);
}
