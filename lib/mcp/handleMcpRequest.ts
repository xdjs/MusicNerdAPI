import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/createMcpServer";
import { withCorsHeaders } from "@/lib/networking/withCorsHeaders";

/**
 * Runs one request through a fresh stateless Streamable HTTP transport (no
 * session id, so no session) connected to a fresh server. The transport
 * decides the status: 406/415 for the wrong headers, 202 for notifications,
 * an SSE stream for requests.
 *
 * @param req - The incoming request.
 * @returns The transport's response, with the CORS headers.
 */
export async function handleMcpRequest(req: Request): Promise<Response> {
  console.log(`[MCP] Incoming ${req.method} request`);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createMcpServer();
  await server.connect(transport);

  return withCorsHeaders(await transport.handleRequest(req));
}
