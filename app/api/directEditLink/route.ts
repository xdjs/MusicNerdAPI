import { NextResponse } from "next/server";
import { postDirectEditLinkHandler } from "@/lib/directEditLink/postDirectEditLinkHandler";
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
 * Sets or clears one platform link on the artist.
 *
 * @param request - The request; a claimant or admin Privy token and `{ artistId, action, url?, siteName? }`.
 * @returns 200 with `{ status, success, siteName?, platformName? }`, or an error.
 */
export async function POST(request: Request) {
  return postDirectEditLinkHandler(request);
}
