import { MCP_SERVER_INFO } from "@/lib/mcp/const";
import { handleMcpRequest } from "@/lib/mcp/handleMcpRequest";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles GET /api/mcp: the standalone SSE stream when the client accepts
 * `text/event-stream`, otherwise the server info as a health check.
 *
 * @param req - The incoming request.
 * @returns The stream, the info, or 500 `{ error }`.
 */
export async function getMcpHandler(req: Request): Promise<Response> {
  const start = performance.now();
  const headers = { ...getCorsHeaders(), "Content-Type": "application/json" };

  try {
    console.log("[MCP] GET request received");

    const acceptHeader = req.headers.get("Accept") ?? "";
    if (acceptHeader.includes("text/event-stream")) {
      return await handleMcpRequest(req);
    }

    return new Response(
      JSON.stringify({
        ...MCP_SERVER_INFO,
        status: "ok",
        protocol: "mcp",
        transport: "streamable-http",
      }),
      { status: 200, headers },
    );
  } catch (error) {
    console.error("[MCP] GET error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers,
    });
  } finally {
    console.log(`[MCP] GET took ${performance.now() - start}ms`);
  }
}
