import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postTokenHandler } from "@/lib/oauth/postTokenHandler";

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
 * Swaps an authorization code or a refresh token for a new token pair.
 *
 * @param request - The form-encoded token request.
 * @returns 200 with the tokens; 400 or 500 in the OAuth error shape.
 */
export async function POST(request: Request) {
  return postTokenHandler(request);
}
