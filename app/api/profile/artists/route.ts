import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileArtistsHandler } from "@/lib/profile/getProfileArtistsHandler";

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
 * A page of the artists the caller contributed to.
 *
 * @param request - The request: a Privy token, `X-Profile-Account`, optional `offset` and `q`.
 * @returns The handler's response.
 */
export async function GET(request: Request) {
  return getProfileArtistsHandler(request);
}
