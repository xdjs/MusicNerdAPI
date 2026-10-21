import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import { logMcpAudit } from "@/lib/mcp/logMcpAudit";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";
import { requireMcpAuth } from "@/lib/mcpAuth/requireMcpAuth";

/**
 * Registers `set_artist_link`: writes the platform link a URL implies on an
 * artist. Needs an MCP API key (checked first, before any database work) and
 * records the change in the audit log, best-effort.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerSetArtistLinkTool(server: McpServer) {
  return server.registerTool(
    "set_artist_link",
    {
      title: "Set Artist Link",
      description:
        "Set a platform link on an artist record. The platform is automatically inferred from the URL.",
      inputSchema: {
        artistId: z.string().uuid().describe("The UUID of the artist in MusicNerd"),
        url: z
          .string()
          .url()
          .describe("The platform URL to set (e.g. https://instagram.com/username)"),
      },
    },
    async ({ artistId, url }) => {
      console.log(`[MCP] set_artist_link called with artistId="${artistId}", url="${url}"`);

      try {
        const apiKeyHash = requireMcpAuth();

        const extracted = await extractArtistId(url);
        if (!extracted || !extracted.id) {
          return toolError("URL does not match any approved platform", "INVALID_URL");
        }

        const { siteName, id: extractedId } = extracted;

        const { oldValue } = await setArtistLink(artistId, siteName, extractedId);

        // Audit is best-effort: the mutation succeeded, a log failure mustn't hide that.
        try {
          await logMcpAudit({
            artistId,
            field: siteName,
            action: "set",
            submittedUrl: url,
            oldValue,
            newValue: extractedId,
            apiKeyHash,
          });
        } catch (auditError) {
          console.error("[MCP] Audit log failed (mutation succeeded):", auditError);
        }

        return toolText({ success: true, siteName, extractedId, oldValue });
      } catch (error) {
        if (error instanceof McpAuthError) {
          return toolError(error.message, "AUTH_REQUIRED");
        }
        if (error instanceof Error && error.message.startsWith("Artist not found")) {
          return toolError("Artist not found", "NOT_FOUND");
        }
        if (error instanceof ArtistLinkConflictError) {
          return toolError(error.message, "CONFLICT");
        }
        console.error("[MCP] set_artist_link error:", error);
        return toolError("Failed to set artist link", "INTERNAL_ERROR");
      }
    },
  );
}
