import { handleMcpRequest } from "@/lib/mcp/handleMcpRequest";
import { mcpRequestContext } from "@/lib/mcpAuth/mcpRequestContext";
import { validateMcpApiKey } from "@/lib/mcpAuth/validateMcpApiKey";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/mcp, the JSON-RPC endpoint. A request with an
 * `Authorization` header whose key is unknown or revoked is refused with 401
 * before the transport sees it. A request without the header proceeds so the
 * read-only tools stay available; only a valid key opens the request context
 * the write tools demand.
 *
 * @param req - The incoming request.
 * @returns The transport's response; 401 or 500 as a JSON-RPC error.
 */
export async function postMcpHandler(req: Request): Promise<Response> {
  const start = performance.now();
  const headers = { ...getCorsHeaders(), "Content-Type": "application/json" };

  try {
    console.log("[MCP] POST request received");

    const authHeader = req.headers.get("authorization");
    const apiKeyHash = authHeader ? await validateMcpApiKey(req) : null;

    if (authHeader && !apiKeyHash) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Invalid or revoked API key" },
          id: null,
        }),
        { status: 401, headers },
      );
    }

    return apiKeyHash
      ? await mcpRequestContext.run({ apiKeyHash }, () => handleMcpRequest(req))
      : await handleMcpRequest(req);
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
