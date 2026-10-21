import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { logMcpAudit } from "@/lib/mcp/logMcpAudit";
import { MappingConcurrentWriteError } from "@/lib/mcp/MappingConcurrentWriteError";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { resolveArtistMapping } from "@/lib/mcp/resolveArtistMapping";
import { resolveArtistMappingBatch } from "@/lib/mcp/resolveArtistMappingBatch";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";
import { requireMcpAuth } from "@/lib/mcpAuth/requireMcpAuth";

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
 * in `items`, each independent. Needs an MCP API key (checked first); every
 * stored mapping is audited, skipped ones are not.
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
        const apiKeyHash = requireMcpAuth();

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
            apiKeyHash,
          });

          if (!result.skipped) {
            try {
              await logMcpAudit({
                artistId,
                field: `mapping:${platform}`,
                action: "resolve",
                oldValue: result.previousMapping?.platformId ?? null,
                newValue: platformId,
                apiKeyHash,
              });
            } catch (auditError) {
              console.error("[MCP] Audit log failed (mutation succeeded):", auditError);
            }
          }

          return toolText({ success: true, ...result });
        }

        const batchResult = await resolveArtistMappingBatch(items, apiKeyHash);

        const auditEntries = batchResult.results
          .map((r, i) => ({ r, item: items[i] }))
          .filter(({ r }) => !r.skipped && !r.error)
          .map(({ r, item }) => ({
            artistId: item.artistId,
            field: `mapping:${item.platform}`,
            action: "resolve" as const,
            oldValue: r.previousMapping?.platformId ?? null,
            newValue: item.platformId,
            apiKeyHash,
          }));

        if (auditEntries.length > 0) {
          try {
            await logMcpAudit(auditEntries);
          } catch (auditError) {
            console.error("[MCP] Batch audit log failed (mutations succeeded):", auditError);
          }
        }

        return toolText({ success: true, results: batchResult.results });
      } catch (error) {
        if (error instanceof McpAuthError) {
          return toolError(error.message, "AUTH_REQUIRED");
        }
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
