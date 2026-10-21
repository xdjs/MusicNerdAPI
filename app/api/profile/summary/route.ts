import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileSummaryHandler } from "@/lib/profile/getProfileSummaryHandler";

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
 * The caller's contribution counts and latest submissions.
 *
 * @param request - The request: a Privy token and `X-Profile-Account`.
 * @returns The handler's response.
 */
export async function GET(request: Request) {
  return getProfileSummaryHandler(request);
}
