import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAuthorizationServerMetadata } from "@/lib/oauth/getAuthorizationServerMetadata";

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
 * The OAuth authorization server metadata (RFC 8414) for `/api/oauth`.
 *
 * @param request - The request; its origin names the issuer.
 * @returns 200 with the metadata.
 */
export async function GET(request: Request) {
  return NextResponse.json(getAuthorizationServerMetadata(new URL(request.url).origin), {
    headers: getCorsHeaders(),
  });
}
