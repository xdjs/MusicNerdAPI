import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { findBoardKey } from "@/lib/board/findBoardKey";
import { registerBoardTools } from "@/lib/board/registerBoardTools";
import { team } from "@/lib/board/team";
import { withCorsHeaders } from "@/lib/networking/withCorsHeaders";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * Handles POST /api/board/mcp/{key}: one agent's board MCP server. The key
 * names the agent's profile; the agent can only read and post, as that profile.
 *
 * @param req - The incoming request.
 * @param key - The agent key from the path.
 * @returns The transport's response; 401 or 500 as a JSON-RPC error.
 */
export async function postBoardMcpHandler(req: Request, key: string): Promise<Response> {
  const headers = { ...getCorsHeaders(), "Content-Type": "application/json" };
  const failure = (status: number, code: number, message: string) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
      status,
      headers,
    });
  try {
    const profile = await findBoardKey(key);
    if (!profile) return failure(401, -32000, "Invalid or revoked board key");
    const server = new McpServer({ name: "Music Nerd board", version: "1.0.0" });
    registerBoardTools(server, team.as(profile, { can: ["read", "post"] }));
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return withCorsHeaders(await transport.handleRequest(req));
  } catch (error) {
    console.error("[board MCP] POST error:", error);
    return failure(500, -32603, "Internal server error");
  }
}
