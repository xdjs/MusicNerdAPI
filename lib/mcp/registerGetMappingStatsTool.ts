import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMappingStats } from "@/lib/mcp/getMappingStats";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

/**
 * Registers `get_mapping_stats`: mapping coverage per platform.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerGetMappingStatsTool(server: McpServer) {
  return server.registerTool(
    "get_mapping_stats",
    {
      title: "Get Mapping Stats",
      description:
        "Get statistics about cross-platform artist ID mapping coverage across all platforms.",
      inputSchema: {},
    },
    async () => {
      console.log("[MCP] get_mapping_stats called");

      try {
        const stats = await getMappingStats();
        return toolText(stats);
      } catch (error) {
        console.error("[MCP] get_mapping_stats error:", error);
        return toolError("Failed to get mapping stats", "INTERNAL_ERROR");
      }
    },
  );
}
