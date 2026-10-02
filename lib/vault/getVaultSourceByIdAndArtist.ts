import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";

/**
 * One vault source, only if it belongs to the artist.
 *
 * @param sourceId - The source.
 * @param artistId - The artist it must belong to.
 * @returns The source, or undefined when it's someone else's, missing, or the read failed.
 */
export async function getVaultSourceByIdAndArtist(
  sourceId: string,
  artistId: string,
): Promise<VaultSource | undefined> {
  try {
    return await db.query.artistVaultSources.findFirst({
      where: and(eq(artistVaultSources.id, sourceId), eq(artistVaultSources.artistId, artistId)),
    });
  } catch (e) {
    console.error("[getVaultSourceByIdAndArtist] Error:", e);
    return undefined;
  }
}
