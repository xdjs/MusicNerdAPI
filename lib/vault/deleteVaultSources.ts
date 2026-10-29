import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistVaultSources } from "@/lib/db/schema";
import type { VaultSource } from "@/lib/vault/types";

/** Thrown inside the transaction to roll back a partial delete. */
class PartialDeleteError extends Error {}

/**
 * Deletes several of one artist's vault sources, all or nothing: when any id
 * is missing or belongs to another artist, nothing is deleted.
 *
 * @param artistId - The artist the sources must belong to.
 * @param sourceIds - The sources; duplicates are ignored.
 * @returns The deleted sources, or undefined when any id wasn't the artist's. A failed write throws.
 */
export async function deleteVaultSources(
  artistId: string,
  sourceIds: string[],
): Promise<VaultSource[] | undefined> {
  const ids = [...new Set(sourceIds)];
  try {
    return await db.transaction(async tx => {
      await lockArtistRow(tx, artistId);
      const deleted = await tx
        .delete(artistVaultSources)
        .where(and(eq(artistVaultSources.artistId, artistId), inArray(artistVaultSources.id, ids)))
        .returning();
      if (deleted.length !== ids.length) throw new PartialDeleteError();
      return deleted;
    });
  } catch (e) {
    if (e instanceof PartialDeleteError) return undefined;
    console.error("[deleteVaultSources] Error:", e);
    throw e;
  }
}
