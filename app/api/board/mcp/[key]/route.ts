import { NextResponse } from "next/server";
import { postBoardMcpHandler } from "@/lib/board/postBoardMcpHandler";
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
 * One agent's board MCP server over Streamable HTTP: the key in the path is the credential.
 *
 * @param request - The JSON-RPC request.
 * @param context - The route context.
 * @param context.params - Holds the agent `key`.
 * @returns The responses as server-sent events, or a JSON-RPC error.
 */
export async function POST(request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  return postBoardMcpHandler(request, key);
}
