import { NextResponse } from "next/server";
import { getMcpKeysHandler } from "@/lib/mcpKeys/getMcpKeysHandler";
import { postMcpKeysHandler } from "@/lib/mcpKeys/postMcpKeysHandler";
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
 * Every MCP API key, newest first, as a bare array.
 *
 * @param request - The request; an admin's Privy token.
 * @returns 200 with the keys, or an error.
 */
export async function GET(request: Request) {
  return getMcpKeysHandler(request);
}

/**
 * Creates an MCP API key and returns it once.
 *
 * @param request - The request; an admin's Privy token and `{ label }`.
 * @returns 201 with `{ status, rawKey, label }`, or an error.
 */
export async function POST(request: Request) {
  return postMcpKeysHandler(request);
}
