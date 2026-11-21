import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";
import { extractArtistId } from "@/lib/artists/extractArtistId";
import { db } from "@/lib/db/db";
import { toolError } from "@/lib/mcp/toolError";
import { toolText } from "@/lib/mcp/toolText";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Registers `set_artist_link`: writes the platform link a URL implies on an
 * artist, as the connection's admin, the way an admin's edit on the site does
 * (the write re-checks the claim and the admin role under the artist lock).
 *
 * @param server - The server to register on.
 * @param userId - The admin the connection belongs to.
 * @returns The registered tool.
 */
export function registerSetArtistLinkTool(server: McpServer, userId: string) {
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
        const extracted = await extractArtistId(url);
        if (!extracted || !extracted.id) {
          return toolError("URL does not match any approved platform", "INVALID_URL");
        }

        const { siteName, id: extractedId } = extracted;
        const expectedClaimId = (await findApprovedClaim(db, artistId))?.id ?? null;
        const { oldValue } = await withArtistOperation(artistId, { userId, expectedClaimId }, () =>
          setArtistLink(artistId, siteName, extractedId),
        );

        return toolText({ success: true, siteName, extractedId, oldValue });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Artist not found")) {
          return toolError("Artist not found", "NOT_FOUND");
        }
        if (error instanceof ArtistLinkConflictError) {
          return toolError(error.message, "CONFLICT");
        }
        if (error instanceof OwnershipChangedError) {
          return toolError(error.message, "FORBIDDEN");
        }
        console.error("[MCP] set_artist_link error:", error);
        return toolError("Failed to set artist link", "INTERNAL_ERROR");
      }
    },
  );
}
