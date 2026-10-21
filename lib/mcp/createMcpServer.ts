import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_SERVER_INFO } from "@/lib/mcp/const";
import { registerDeleteArtistLinkTool } from "@/lib/mcp/registerDeleteArtistLinkTool";
import { registerExcludeArtistMappingTool } from "@/lib/mcp/registerExcludeArtistMappingTool";
import { registerGetArtistMappingsTool } from "@/lib/mcp/registerGetArtistMappingsTool";
import { registerGetArtistTool } from "@/lib/mcp/registerGetArtistTool";
import { registerGetMappingExclusionsTool } from "@/lib/mcp/registerGetMappingExclusionsTool";
import { registerGetMappingStatsTool } from "@/lib/mcp/registerGetMappingStatsTool";
import { registerGetUnmappedArtistsTool } from "@/lib/mcp/registerGetUnmappedArtistsTool";
import { registerResolveArtistIdTool } from "@/lib/mcp/registerResolveArtistIdTool";
import { registerSearchArtistsTool } from "@/lib/mcp/registerSearchArtistsTool";
import { registerSetArtistLinkTool } from "@/lib/mcp/registerSetArtistLinkTool";

/**
 * The Music Nerd MCP server with its ten tools, in the order `tools/list`
 * returns them. Built once per request: a server holds one transport, and the
 * stateless transport is one per request.
 *
 * Every mutating tool calls `requireMcpAuth()` before any database work; the
 * read-only tools need no key.
 *
 * @returns A new server.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ ...MCP_SERVER_INFO });
  registerSearchArtistsTool(server);
  registerGetArtistTool(server);
  registerSetArtistLinkTool(server);
  registerDeleteArtistLinkTool(server);
  registerGetUnmappedArtistsTool(server);
  registerGetMappingStatsTool(server);
  registerGetArtistMappingsTool(server);
  registerResolveArtistIdTool(server);
  registerExcludeArtistMappingTool(server);
  registerGetMappingExclusionsTool(server);
  return server;
}
