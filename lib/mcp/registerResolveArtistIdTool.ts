import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { MappingConcurrentWriteError } from "@/lib/mcp/MappingConcurrentWriteError";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { resolveArtistMapping } from "@/lib/mcp/resolveArtistMapping";
import { resolveArtistMappingBatch } from "@/lib/mcp/resolveArtistMappingBatch";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";

const resolveItemSchema = z.object({
  artistId: z.string().uuid().describe("The UUID of the artist in MusicNerd"),
  platform: z
    .string()
    .describe(
      "The target platform (e.g. deezer, apple_music, musicbrainz, wikidata, tidal, amazon_music, youtube_music)",
    ),
  platformId: z.string().describe("The artist's ID on the target platform"),
  confidence: z
    .enum(["high", "medium", "low", "manual"])
    .describe("Confidence level of the mapping (manual > high > medium > low)"),
  source: z
    .enum(["wikidata", "musicbrainz", "name_search", "web_search", "manual"])
    .describe("How the mapping was determined"),
  reasoning: z
    .string()
    .optional()
    .describe("Optional explanation of how the mapping was determined"),
});

/**
 * Registers `resolve_artist_id`: stores one mapping, or a batch of up to 100
 * in `items`, each independent. Registered for admins only.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerResolveArtistIdTool(server: McpServer) {
  return server.registerTool(
    "resolve_artist_id",
    {
      title: "Resolve Artist ID",
      description:
        "Store cross-platform ID mapping(s) for artist(s). For a single item, provide the fields directly. For batch mode, provide an 'items' array instead. Each batch item is processed independently — partial failures do not roll back successful items.",
      inputSchema: {
        artistId: z
          .string()
          .uuid()
          .optional()
          .describe("The UUID of the artist (single-item mode)"),
        platform: z.string().optional().describe("The target platform (single-item mode)"),
        platformId: z
          .string()
          .optional()
          .describe("The artist's ID on the target platform (single-item mode)"),
        confidence: z
          .enum(["high", "medium", "low", "manual"])
          .optional()
          .describe("Confidence level (single-item mode)"),
        source: z
          .enum(["wikidata", "musicbrainz", "name_search", "web_search", "manual"])
          .optional()
          .describe("How the mapping was determined (single-item mode)"),
        reasoning: z
          .string()
          .optional()
          .describe("Optional explanation of how the mapping was determined"),
        items: z
          .array(resolveItemSchema)
          .max(100)
          .optional()
          .describe(
            "Array of items for batch mode (max 100). When provided, the individual fields above are ignored.",
          ),
      },
    },
    async ({ artistId, platform, platformId, confidence, source, reasoning, items }) => {
      console.log(
        `[MCP] resolve_artist_id called with ${items !== undefined ? items.length + " item(s) (batch)" : "1 item(s)"}`,
      );

      try {
        if (items === undefined) {
          if (!artistId || !platform || !platformId || !confidence || !source) {
            return toolError(
              "Missing required fields: artistId, platform, platformId, confidence, source",
              "INVALID_INPUT",
            );
          }

          if (!VALID_MAPPING_PLATFORMS.has(platform)) {
            return toolError(
              `Invalid platform. Valid platforms: ${[...VALID_MAPPING_PLATFORMS].join(", ")}`,
              "INVALID_INPUT",
            );
          }

          const result = await resolveArtistMapping({
            artistId,
            platform,
            platformId,
            confidence,
            source,
            reasoning,
          });

          return toolText({ success: true, ...result });
        }

        const batchResult = await resolveArtistMappingBatch(items);
        return toolText({ success: true, results: batchResult.results });
      } catch (error) {
        if (error instanceof MappingNotFoundError) {
          return toolError("Artist not found", "NOT_FOUND");
        }
        if (error instanceof MappingConflictError) {
          return toolError(error.message, "CONFLICT");
        }
        // Another request already wrote this mapping; not an error for the caller.
        if (error instanceof MappingConcurrentWriteError) {
          return toolText({
            success: true,
            created: false,
            updated: false,
            skipped: true,
            reason: "concurrent_write",
          });
        }
        if (error instanceof MappingValidationError) {
          return toolError(error.message, "INVALID_INPUT");
        }
        console.error("[MCP] resolve_artist_id error:", error);
        return toolError("Failed to resolve artist ID", "INTERNAL_ERROR");
      }
    },
  );
}
