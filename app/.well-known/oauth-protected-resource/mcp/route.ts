import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResourceMetadata } from "@/lib/oauth/getResourceMetadata";

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
 * The OAuth protected-resource metadata for `/mcp` (RFC 9728), which an MCP
 * client reads after a 401 to find the authorization server.
 *
 * @param request - The request; its origin names the resource.
 * @returns 200 with the metadata.
 */
export async function GET(request: Request) {
  return NextResponse.json(getResourceMetadata(new URL(request.url).origin), {
    headers: getCorsHeaders(),
  });
}
