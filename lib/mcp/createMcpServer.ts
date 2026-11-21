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
import type { McpContext } from "@/lib/mcp/types";

/**
 * The Music Nerd MCP server with the tools this connection may use: the read
 * tools for everyone signed in, and the link and ID-mapping writes for
 * admins, which act as that admin. Built once per request: a server holds one
 * transport, and the stateless transport is one per request.
 *
 * @param context - Who the request runs as.
 * @returns A new server.
 */
export function createMcpServer(context: McpContext): McpServer {
  const server = new McpServer({ ...MCP_SERVER_INFO });
  registerSearchArtistsTool(server);
  registerGetArtistTool(server);
  registerGetUnmappedArtistsTool(server);
  registerGetMappingStatsTool(server);
  registerGetArtistMappingsTool(server);
  registerGetMappingExclusionsTool(server);
  if (context.isAdmin) {
    registerSetArtistLinkTool(server, context.userId);
    registerDeleteArtistLinkTool(server, context.userId);
    registerResolveArtistIdTool(server);
    registerExcludeArtistMappingTool(server);
  }
  return server;
}
