import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postAskArtistHandler } from "@/lib/questionResearch/postAskArtistHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * Answers a listener's question about an artist from checked public evidence:
 * reuses a verified answer, or plans the question, starts bounded research and
 * returns 202 with the job to poll. Public; a Privy token only scopes the
 * hourly visitor allowance to the account.
 *
 * @param request - `{ artistId, question, jobId?, conversation? }`.
 * @returns 200 with the answer, 202 with `research` progress, or an error.
 */
export async function POST(request: Request) {
  return postAskArtistHandler(request);
}
