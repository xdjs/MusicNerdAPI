import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { clearArtistLink } from "@/lib/artistLinks/clearArtistLink";
import { db } from "@/lib/db/db";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Registers `delete_artist_link`: clears one platform link, as the
 * connection's admin, the way an admin's edit on the site does.
 *
 * @param server - The server to register on.
 * @param userId - The admin the connection belongs to.
 * @returns The registered tool.
 */
export function registerDeleteArtistLinkTool(server: McpServer, userId: string) {
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
        if (siteName.toLowerCase() === "spotify" || siteName.toLowerCase() === "deezer")
          return toolError(
            "Catalog disconnect requires the authenticated profile editor with the displayed account ID. Use POST /api/directEditLink with a Privy bearer token.",
            "OWNER_DISCONNECT_REQUIRED",
          );

        const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
        const { oldValue } = await withArtistOperation(artistId, { userId, expectedClaimId }, () =>
          clearArtistLink(artistId, siteName),
        );

        if (oldValue === null) {
          return toolError("Link is not set", "NOT_SET");
        }

        return toolText({ success: true, siteName, oldValue });
      } catch (error) {
        if (error instanceof OwnershipChangedError) {
          return toolError(error.message, "FORBIDDEN");
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
