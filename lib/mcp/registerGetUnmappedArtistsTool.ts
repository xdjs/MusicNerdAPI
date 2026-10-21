import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getUnmappedArtists } from "@/lib/mcp/getUnmappedArtists";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

/**
 * Registers `get_unmapped_artists`: a page of artists still to map for a
 * platform, `limit` clamped to 1..200.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerGetUnmappedArtistsTool(server: McpServer) {
  return server.registerTool(
    "get_unmapped_artists",
    {
      title: "Get Unmapped Artists",
      description:
        "Get artists that have a platform ID but no mapping for a given target platform. Use basePlatform to select the source (default: spotify, use 'deezer' for Deezer-primary workflows).",
      inputSchema: {
        platform: z
          .string()
          .describe(
            "The target platform to check for missing mappings (e.g. deezer, apple_music, musicbrainz, wikidata, tidal, amazon_music, youtube_music)",
          ),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe("Maximum number of results to return (default 50, max 200)"),
        offset: z.number().optional().default(0).describe("Offset for pagination (default 0)"),
        basePlatform: z
          .enum(["spotify", "deezer"])
          .optional()
          .default("spotify")
          .describe(
            "Which platform ID to require on source artists (default: spotify). Use 'deezer' to find artists with Deezer IDs that lack mappings.",
          ),
      },
    },
    async ({ platform, limit, offset, basePlatform }) => {
      console.log(
        `[MCP] get_unmapped_artists called with platform="${platform}", basePlatform="${basePlatform}", limit=${limit}, offset=${offset}`,
      );

      try {
        const effectiveLimit = Math.min(Math.max(limit ?? 50, 1), 200);
        const effectiveOffset = Math.max(offset ?? 0, 0);

        const effectiveBasePlatform = basePlatform === "deezer" ? "deezer" : "spotify";
        const result = await getUnmappedArtists(
          platform,
          effectiveLimit,
          effectiveOffset,
          effectiveBasePlatform,
        );

        return toolText({
          platform,
          artists: result.artists,
          totalUnmapped: result.totalUnmapped,
          limit: effectiveLimit,
          offset: effectiveOffset,
        });
      } catch (error) {
        if (error instanceof MappingValidationError) {
          return toolError(error.message, "INVALID_INPUT");
        }
        console.error("[MCP] get_unmapped_artists error:", error);
        return toolError("Failed to get unmapped artists", "INTERNAL_ERROR");
      }
    },
  );
}
