import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getProfileUpdatesHandler } from "@/lib/profile/getProfileUpdatesHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
/**
 * CORS preflight.
 *
 * @returns 200 with the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * The stored Latest cards of the caller's artists, six artists per page.
 *
 * @param request - The request: a Privy token, `X-Profile-Account`, optional `offset` and `kind`.
 * @returns The handler's response.
 */
export async function GET(request: Request) {
  return getProfileUpdatesHandler(request);
}
