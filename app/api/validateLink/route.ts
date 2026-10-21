import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postValidateLinkHandler } from "@/lib/validateLink/postValidateLinkHandler";

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
 * Says whether a supported platform's profile page exists. Public.
 *
 * @param request - The request; `{ url }`.
 * @returns 200 with `{ status, valid, reason? }`, or 400.
 */
export async function POST(request: Request) {
  return postValidateLinkHandler(request);
}
