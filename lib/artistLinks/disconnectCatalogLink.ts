import { CatalogDisconnectUnavailableError } from "@/lib/artistLinks/CatalogDisconnectUnavailableError";
import { sql } from "drizzle-orm";
import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { db } from "@/lib/db/db";
import { rowsOf } from "@/lib/db/rowsOf";
import { extractPgError } from "@/lib/mcp/extractPgError";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Reversibly disconnects one displayed catalog identity using the private,
 * Web-migrated function. Requires authenticated user scope, never MCP key scope.
 * The function rechecks claim/role/CAS and archives DB-derived provenance.
 * Missing migration/permission fails; there is no legacy-clear fallback.
 *
 * @param artistId - The scoped artist.
 * @param platform - Spotify or Deezer.
 * @param expectedValue - The account ID the user saw; null explicitly means empty.
 * @param authorization - Existing owner or contributor authorization contract.
 * @returns The previous ID only; never the private mapping attribution.
 */
export async function disconnectCatalogLink(
  artistId: string,
  platform: "spotify" | "deezer",
  expectedValue: string | null | undefined,
  authorization: "owner" | "contributor" = "owner",
): Promise<{ oldValue: string | null }> {
  const scope = getArtistOperationOwnership(artistId);
  if (!scope?.userId) throw new OwnershipChangedError();
  if (expectedValue === undefined || (expectedValue !== null && !expectedValue.trim()))
    throw new ArtistLinkConflictError("Refresh the profile before disconnecting this catalog link");
  try {
    return await db.transaction(async transaction => {
      await acquireArtistPlatformLock(transaction, artistId, platform);
      const mapping =
        (
          rowsOf(
            await transaction.execute(sql`
          SELECT to_jsonb(m) AS snapshot FROM public.artist_id_mappings m
          WHERE m.artist_id = ${artistId}::uuid AND m.platform = ${platform}
        `),
          ) as Array<{ snapshot: Record<string, unknown> }>
        )[0]?.snapshot ?? null;
      const result = rowsOf(
        await transaction.execute(sql`
          SELECT musicnerd_private.disconnect_catalog_link(
            ${artistId}::uuid, ${platform}, ${expectedValue},
            ${mapping === null ? null : JSON.stringify(mapping)}::jsonb,
            ${scope.userId}::uuid, ${scope.expectedClaimId}::uuid, ${authorization}
          ) AS old_value
        `),
      ) as Array<{ old_value: string | null }>;
      if (result.length !== 1) throw new Error("Catalog disconnect returned no result");
      return { oldValue: result[0].old_value };
    });
  } catch (error) {
    const code = extractPgError(error)?.code;
    if (code === "P1580")
      throw new ArtistLinkConflictError(
        "Catalog identity or mapping changed; refresh and review before disconnecting",
      );
    if (code === "P1581") throw new OwnershipChangedError();
    // Drizzle errors contain bound mapping JSON, including private attribution.
    // Never propagate that query/cause into a route log or response.
    throw new CatalogDisconnectUnavailableError();
  }
}
