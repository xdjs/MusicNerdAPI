import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchForArtistByName } from "@/lib/artists/searchForArtistByName";
import { toArtistSummary } from "@/lib/mcp/toArtistSummary";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

/**
 * Registers `search_artists`: artists by name, `limit` clamped to 50. An
 * empty query returns no results rather than everything.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerSearchArtistsTool(server: McpServer) {
  return server.registerTool(
    "search_artists",
    {
      title: "Search Artists",
      description: "Search for artists in the MusicNerd database by name",
      inputSchema: {
        query: z.string().describe("The search query to find artists by name"),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of results to return (default 10, max 50)"),
      },
    },
    async ({ query, limit }) => {
      console.log(`[MCP] search_artists called with query="${query}", limit=${limit}`);

      try {
        const trimmedQuery = query?.trim() ?? "";
        if (trimmedQuery === "") {
          return toolText({ artists: [], totalResults: 0 });
        }

        const effectiveLimit = Math.min(limit ?? 10, 50);

        const artists = await searchForArtistByName(trimmedQuery);
        const artistSummaries = artists.slice(0, effectiveLimit).map(toArtistSummary);

        return toolText({ artists: artistSummaries, totalResults: artistSummaries.length });
      } catch (error) {
        console.error("[MCP] search_artists error:", error);
        return toolError("Failed to search artists", "INTERNAL_ERROR");
      }
    },
  );
}
