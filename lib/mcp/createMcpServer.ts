import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBoardTools } from "@/lib/board/registerBoardTools";
import { team } from "@/lib/board/team";
import { toBoardProfile } from "@/lib/board/toBoardProfile";
import { getMcpServerInfo } from "@/lib/mcp/getMcpServerInfo";
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
 * tools for everyone signed in, the link and ID-mapping writes for admins,
 * which act as that admin, and the board tools for team members, which read
 * and post as `<agent>-<member>`. Built once per request: a server holds one
 * transport, and the stateless transport is one per request.
 *
 * @param context - Who the request runs as.
 * @param origin - The request's origin, which serves the server's icon.
 * @returns A new server.
 */
export function createMcpServer(context: McpContext, origin: string): McpServer {
  const server = new McpServer(getMcpServerInfo(origin));
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
  if (context.member)
    registerBoardTools(
      server,
      team.as(toBoardProfile(context.agent, context.member), { can: ["read", "post"] }),
    );
  return server;
}
