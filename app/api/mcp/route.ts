import { NextResponse } from "next/server";
import { deleteMcpHandler } from "@/lib/mcp/deleteMcpHandler";
import { getMcpHandler } from "@/lib/mcp/getMcpHandler";
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
 *
 * @param req - The request; an MCP API key as `Authorization: Bearer` for the write tools.
 * @returns The responses as server-sent events, 202 for notifications, or a JSON-RPC error.
 */
export async function POST(req: Request): Promise<Response> {
  return postMcpHandler(req);
}

/**
 * The MCP standalone SSE stream, or the server info as a health check.
 *
 * @param req - The request; `Accept: text/event-stream` for the stream.
 * @returns The stream, or 200 with the server info.
 */
export async function GET(req: Request): Promise<Response> {
  return getMcpHandler(req);
}

/**
 * Ends an MCP session; the server is stateless, so this acknowledges and does nothing.
 *
 * @param req - The request.
 * @returns 200 with no body.
 */
export async function DELETE(req: Request): Promise<Response> {
  return deleteMcpHandler(req);
}
