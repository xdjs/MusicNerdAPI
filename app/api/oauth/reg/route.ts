import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postRegisterClientHandler } from "@/lib/oauth/postRegisterClientHandler";

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
 * Registers an MCP client (RFC 7591 dynamic client registration).
 *
 * @param request - The request; `{ client_name?, redirect_uris }`.
 * @returns 201 with `client_id`; 400 or 500 in the OAuth error shape.
 */
export async function POST(request: Request) {
  return postRegisterClientHandler(request);
}
