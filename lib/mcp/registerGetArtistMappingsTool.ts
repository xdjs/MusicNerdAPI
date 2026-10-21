import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistMappings } from "@/lib/mcp/getArtistMappings";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

/**
 * Registers `get_artist_mappings`: every cross-platform id mapping for one artist.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerGetArtistMappingsTool(server: McpServer) {
  return server.registerTool(
    "get_artist_mappings",
    {
      title: "Get Artist Mappings",
      description: "Get all cross-platform ID mappings for a specific artist.",
      inputSchema: {
        artistId: z.string().uuid().describe("The UUID of the artist in MusicNerd"),
      },
    },
    async ({ artistId }) => {
      console.log(`[MCP] get_artist_mappings called with artistId="${artistId}"`);

      try {
        const mappings = await getArtistMappings(artistId);
        return toolText({ artistId, mappings, totalMappings: mappings.length });
      } catch (error) {
        if (error instanceof MappingNotFoundError) {
          return toolError("Artist not found", "NOT_FOUND");
        }
        console.error("[MCP] get_artist_mappings error:", error);
        return toolError("Failed to get artist mappings", "INTERNAL_ERROR");
      }
    },
  );
}
