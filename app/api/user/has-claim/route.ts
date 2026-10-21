import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getUserHasClaimHandler } from "@/lib/users/getUserHasClaimHandler";

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
 * Whether the caller has an approved artist claim; always 200.
 *
 * @param request - The request, optionally with a Privy token.
 * @returns The handler's response.
 */
export async function GET(request: Request) {
  return getUserHasClaimHandler(request);
}
