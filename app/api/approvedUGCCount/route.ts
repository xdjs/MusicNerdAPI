import { NextResponse } from "next/server";
import { getApprovedUgcCountHandler } from "@/lib/contributions/getApprovedUgcCountHandler";
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
 * How many of the signed-in user's submitted links an admin approved; 0 when signed out.
 *
 * @param request - The request; a Privy token.
 * @returns 200 with `{ status, count }`.
 */
export async function GET(request: Request) {
  return getApprovedUgcCountHandler(request);
}
