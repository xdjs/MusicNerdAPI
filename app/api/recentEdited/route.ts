import { NextResponse } from "next/server";
import { getRecentEditedHandler } from "@/lib/contributions/getRecentEditedHandler";
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
 * The last three artists a user's approved submissions touched, each with an image.
 *
 * @param request - The request; `userId` optional, else a Privy token.
 * @returns 200 with `{ status, entries }`.
 */
export async function GET(request: Request) {
  return getRecentEditedHandler(request);
}
