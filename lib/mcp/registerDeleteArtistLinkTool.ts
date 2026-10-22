import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";
import { logMcpAudit } from "@/lib/mcp/logMcpAudit";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";
import { requireMcpAuth } from "@/lib/mcpAuth/requireMcpAuth";

/**
 * Registers `delete_artist_link`: clears one platform link. Needs an MCP API
 * key (checked first) and records the change in the audit log, best-effort.
 *
 * @param server - The server to register on.
 * @returns The registered tool.
 */
export function registerDeleteArtistLinkTool(server: McpServer) {
  return server.registerTool(
    "delete_artist_link",
    {
      title: "Delete Artist Link",
      description: "Remove a platform link from an artist record",
      inputSchema: {
        artistId: z.string().uuid().describe("The UUID of the artist in MusicNerd"),
        siteName: z.string().describe("The platform name (e.g. instagram, x, spotify, youtube)"),
      },
    },
    async ({ artistId, siteName }) => {
      console.log(
        `[MCP] delete_artist_link called with artistId="${artistId}", siteName="${siteName}"`,
      );

      try {
        const apiKeyHash = requireMcpAuth();
        if (siteName.toLowerCase() === "spotify" || siteName.toLowerCase() === "deezer")
          return toolError(
            "Catalog disconnect requires the authenticated profile editor with the displayed account ID. Use POST /api/directEditLink with a Privy bearer token.",
            "OWNER_DISCONNECT_REQUIRED",
          );

        const { oldValue } = await clearArtistLink(artistId, siteName);

        if (oldValue === null) {
          return toolError("Link is not set", "NOT_SET");
        }

        try {
          await logMcpAudit({ artistId, field: siteName, action: "delete", oldValue, apiKeyHash });
        } catch (auditError) {
          console.error("[MCP] Audit log failed (mutation succeeded):", auditError);
        }

        return toolText({ success: true, siteName, oldValue });
      } catch (error) {
        if (error instanceof McpAuthError) {
          return toolError(error.message, "AUTH_REQUIRED");
        }
        if (error instanceof Error && error.message.startsWith("Artist not found")) {
          return toolError("Artist not found", "NOT_FOUND");
        }
        if (
          error instanceof Error &&
          error.message.startsWith("Column not in writable whitelist")
        ) {
          return toolError("Invalid platform name", "INVALID_PLATFORM");
        }
        console.error("[MCP] delete_artist_link error:", error);
        return toolError("Failed to delete artist link", "INTERNAL_ERROR");
      }
    },
  );
}
