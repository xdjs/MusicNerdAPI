import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getConsentHandler } from "@/lib/oauth/getConsentHandler";
import { postConsentHandler } from "@/lib/oauth/postConsentHandler";

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
 * Checks an authorization request and names the agent asking, for the sign-in page.
 *
 * @param request - The request, with the authorization query.
 * @returns 200 `{ status, agent, redirectHost }`; 400 or 500.
 */
export async function GET(request: Request) {
  return getConsentHandler(request);
}

/**
 * Records the signed-in member's approval or denial.
 *
 * @param request - The request; a Privy access token and the authorization request plus `decision`.
 * @returns 200 `{ status, redirectUrl }`; 400, 401 or 500.
 */
export async function POST(request: Request) {
  return postConsentHandler(request);
}
