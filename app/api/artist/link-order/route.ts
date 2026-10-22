import { NextResponse } from "next/server";
import { putArtistLinkOrderHandler } from "@/lib/artistLinkOrder/putArtistLinkOrderHandler";
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
 * Saves the order of the artist's `links` or `support` group.
 *
 * @param request - The request; a claimant or admin Privy token and `{ artistId, section, order }`.
 * @returns 200 with `{ status, success }`, or an error.
 */
export async function PUT(request: Request) {
  return putArtistLinkOrderHandler(request);
}
