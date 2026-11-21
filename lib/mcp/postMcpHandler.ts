import { authenticateMcpRequest } from "@/lib/mcp/authenticateMcpRequest";
import { handleMcpRequest } from "@/lib/mcp/handleMcpRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /mcp, the JSON-RPC endpoint. Every request needs an OAuth
 * access token; without a valid one the 401 challenge is answered before the
 * transport sees the request.
 *
 * @param req - The incoming request.
 * @returns The transport's response; 401 or 500 as a JSON-RPC error.
 */
export async function postMcpHandler(req: Request): Promise<Response> {
  const start = performance.now();
  const headers = { ...getCorsHeaders(), "Content-Type": "application/json" };

  try {
    console.log("[MCP] POST request received");
    const context = await authenticateMcpRequest(req);
    if (context instanceof Response) return context;
    return await handleMcpRequest(req, context);
  } catch (error) {
    console.error("[MCP] POST error:", error);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      }),
      { status: 500, headers },
    );
  } finally {
    console.log(`[MCP] POST took ${performance.now() - start}ms`);
  }
}
