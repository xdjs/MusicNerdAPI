import { NextResponse } from "next/server";
import { postClaimBuildHandler } from "@/lib/claimBuild/postClaimBuildHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const dynamic = "force-dynamic";

/**
 * CORS preflight: the artist page calls this from the browser to retry a build.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Starts, or restarts, the claimed artist's page build on the server.
 *
 * @param request - The request; a claimant or admin Privy token, or the research key.
 * @param context - The route context.
 * @param context.params - Holds the `artistId`.
 * @returns 200 with `{ status, started, runId }`, or an error.
 */
export async function POST(request: Request, context: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await context.params;
  return postClaimBuildHandler(request, artistId);
}
