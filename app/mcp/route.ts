import { NextResponse } from "next/server";
import { postMcpHandler } from "@/lib/mcp/postMcpHandler";
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
 * The MCP endpoint: JSON-RPC messages and tool calls over Streamable HTTP.
 * POST only: the server keeps no sessions and pushes no messages, so GET and
 * DELETE answer 405.
 *
 * @param req - The request; an MCP API key as `Authorization: Bearer` for the write tools.
 * @returns The responses as server-sent events, 202 for notifications, or a JSON-RPC error.
 */
export async function POST(req: Request): Promise<Response> {
  return postMcpHandler(req);
}
