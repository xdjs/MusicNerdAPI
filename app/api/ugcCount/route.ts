import { NextResponse } from "next/server";
import { getUgcCountHandler } from "@/lib/contributions/getUgcCountHandler";
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
 * How many links the signed-in user has submitted; 0 when signed out.
 *
 * @param request - The request; a Privy token.
 * @returns 200 with `{ status, count }`.
 */
export async function GET(request: Request) {
  return getUgcCountHandler(request);
}
