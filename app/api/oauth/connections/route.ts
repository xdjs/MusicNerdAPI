import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConnectionsHandler } from "@/lib/oauth/getConnectionsHandler";

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
 * The signed-in user's connected agents, newest first.
 *
 * @param request - The request; a Privy access token.
 * @returns 200 `{ status, connections }`; 401 or 500.
 */
export async function GET(request: Request) {
  return getConnectionsHandler(request);
}
