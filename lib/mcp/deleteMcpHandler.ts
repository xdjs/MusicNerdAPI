import { handleMcpRequest } from "@/lib/mcp/handleMcpRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles DELETE /api/mcp, the protocol's session end. There is no session
 * to end, but the request still goes through the transport for protocol
 * compliance, which answers 200.
 *
 * @param req - The incoming request.
 * @returns The transport's response, or 500 `{ error }`.
 */
export async function deleteMcpHandler(req: Request): Promise<Response> {
  console.log("[MCP] DELETE request received");

  try {
    return await handleMcpRequest(req);
  } catch (error) {
    console.error("[MCP] DELETE error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
    });
  }
}
