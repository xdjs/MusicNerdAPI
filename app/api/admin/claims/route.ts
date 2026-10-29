import { NextResponse } from "next/server";
import { getAdminClaimsHandler } from "@/lib/claims/getAdminClaimsHandler";
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
 * Up to 200 artist claims with their artist and claimant, pending first.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with `{ status, claims }`, or an error.
 */
export async function GET(request: Request) {
  return getAdminClaimsHandler(request);
}
