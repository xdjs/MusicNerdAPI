import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPendingUGCCountHandler } from "@/lib/ugc/getPendingUGCCountHandler";

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
 * How many user-submitted links await admin review; 0 for anyone who isn't
 * an admin.
 *
 * @param request - The request; a Privy token, or none.
 * @returns 200 with `{ status, count }`.
 */
export async function GET(request: Request) {
  return getPendingUGCCountHandler(request);
}
