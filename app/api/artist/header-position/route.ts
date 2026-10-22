import { NextResponse } from "next/server";
import { patchHeaderPositionHandler } from "@/lib/artistImages/patchHeaderPositionHandler";
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
 * Saves how far down the artist's header image is framed.
 *
 * @param request - The request; a claimant or admin Privy token, the position as JSON.
 * @returns 200 with `{ status, success }`, or an error.
 */
export async function PATCH(request: Request) {
  return patchHeaderPositionHandler(request);
}
