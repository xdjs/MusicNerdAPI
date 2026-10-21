import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EXCLUSION_REASON_VALUES, VALID_MAPPING_PLATFORMS } from "@/lib/mcp/const";
import { excludeArtistMapping } from "@/lib/mcp/excludeArtistMapping";
import { excludeArtistMappingBatch } from "@/lib/mcp/excludeArtistMappingBatch";
import { logMcpAudit } from "@/lib/mcp/logMcpAudit";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";
import { requireMcpAuth } from "@/lib/mcpAuth/requireMcpAuth";

const excludeItemSchema = z.object({
  artistId: z.string().uuid().describe("The UUID of the artist in MusicNerd"),
  platform: z
    .string()
    .describe(`The target platform (e.g. ${[...VALID_MAPPING_PLATFORMS].join(", ")})`),
  reason: z.enum(EXCLUSION_REASON_VALUES).describe("Why the artist is being excluded"),
  details: z
    .string()
    .optional()
    .describe(
      "Human-readable explanation (e.g. \"MusicNerd '1010 Benja SL' vs Deezer '1010benja' (id=12029768)\")",
    ),
});

/**
 * Registers `exclude_artist_mapping`: marks one artist, or a batch of up to
 * 100 in `items`, as excluded from mapping for a platform. Needs an MCP API
 * key (checked first); every stored exclusion is audited.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerExcludeArtistMappingTool(server: McpServer) {
  return server.registerTool(
    "exclude_artist_mapping",
    {
      title: "Exclude Artist Mapping",
      description:
        "Mark artist(s) as excluded from future mapping batches for a given platform. For a single item, provide the fields directly. For batch mode, provide an 'items' array instead. Each batch item is processed independently — partial failures do not roll back successful items.",
      inputSchema: {
        artistId: z
          .string()
          .uuid()
          .optional()
          .describe("The UUID of the artist (single-item mode)"),
        platform: z
          .string()
          .optional()
          .describe(
            `The target platform (single-item mode, e.g. ${[...VALID_MAPPING_PLATFORMS].join(", ")})`,
          ),
        reason: z
          .enum(EXCLUSION_REASON_VALUES)
          .optional()
          .describe("Why the artist is being excluded (single-item mode)"),
        details: z.string().optional().describe("Human-readable explanation"),
        items: z
          .array(excludeItemSchema)
          .max(100)
          .optional()
          .describe(
            "Array of items for batch mode (max 100). When provided, the individual fields above are ignored.",
          ),
      },
    },
    async ({ artistId, platform, reason, details, items }) => {
      console.log(
        `[MCP] exclude_artist_mapping called with ${items !== undefined ? items.length + " item(s) (batch)" : "1 item(s)"}`,
      );

      try {
        const apiKeyHash = requireMcpAuth();

        if (items === undefined) {
          if (!artistId || !platform || !reason) {
            return toolError(
              "Missing required fields: artistId, platform, reason",
              "INVALID_INPUT",
            );
          }

          const result = await excludeArtistMapping({
            artistId,
            platform,
            reason,
            details,
            apiKeyHash,
          });

          try {
            await logMcpAudit({
              artistId,
              field: `mapping:${platform}`,
              action: "exclude",
              newValue: details ? `${reason}: ${details}` : reason,
              apiKeyHash,
            });
          } catch (auditError) {
            console.error("[MCP] Audit log failed (mutation succeeded):", auditError);
          }

          return toolText({ success: true, ...result });
        }

        const batchResult = await excludeArtistMappingBatch(items, apiKeyHash);

        const auditEntries = batchResult.results
          .map((r, i) => ({ r, item: items[i] }))
          .filter(({ r }) => !r.error)
          .map(({ item }) => ({
            artistId: item.artistId,
            field: `mapping:${item.platform}`,
            action: "exclude" as const,
            newValue: item.details ? `${item.reason}: ${item.details}` : item.reason,
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
        if (error instanceof MappingValidationError) {
          return toolError(error.message, "INVALID_INPUT");
        }
        console.error("[MCP] exclude_artist_mapping error:", error);
        return toolError("Failed to exclude artist mapping", "INTERNAL_ERROR");
      }
    },
  );
}
