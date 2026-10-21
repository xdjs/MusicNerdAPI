import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getArtistById } from "@/lib/artists/getArtistById";
import { toArtistDetail } from "@/lib/mcp/toArtistDetail";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

/**
 * Registers `get_artist`: one artist by UUID with its bio, ids and links.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerGetArtistTool(server: McpServer) {
  return server.registerTool(
    "get_artist",
    {
      title: "Get Artist",
      description: "Get detailed information about an artist by their MusicNerd ID",
      inputSchema: {
        id: z.string().uuid().describe("The UUID of the artist in MusicNerd"),
      },
    },
    async ({ id }) => {
      console.log(`[MCP] get_artist called with id="${id}"`);

      try {
        const artist = await getArtistById(id);

        if (!artist) {
          return toolError("Artist not found", "NOT_FOUND");
        }

        const artistDetail = await toArtistDetail(artist);

        return toolText({ artist: artistDetail });
      } catch (error) {
        console.error("[MCP] get_artist error:", error);

        if (error instanceof z.ZodError) {
          return toolError("Invalid artist ID format - must be a valid UUID", "INVALID_INPUT");
        }

        return toolError("Failed to get artist", "INTERNAL_ERROR");
      }
    },
  );
}
