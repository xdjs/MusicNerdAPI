import { NextResponse } from "next/server";
import { getAdminContributionsHandler } from "@/lib/adminContributions/getAdminContributionsHandler";
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
 * One page of contributions across artists, or one contributor's with their account.
 *
 * @param request - The request; an admin's Privy token and optional `userId`, `query`, `origin`, `type`, `status`, `page`.
 * @returns 200 with the page, per-origin counts and `account`, or an error.
 */
export async function GET(request: Request) {
  return getAdminContributionsHandler(request);
}
