import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getMeHandler } from "@/lib/users/getMeHandler";

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
 * The signed-in caller's own user row and role flags, created on first sign-in.
 *
 * @param request - The request; any signed-in user's Privy token.
 * @returns 200 with the row and `needsLegacyLink`, or an error.
 */
export async function GET(request: Request) {
  return getMeHandler(request);
}
