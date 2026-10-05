import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { db } from "@/lib/db/db";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";
import type { VaultSource, VaultSourceInput } from "@/lib/vault/types";
import { writeVaultSource } from "@/lib/vault/writeVaultSource";

/**
 * Adds a source to the artist's vault, once: the (artist_id, url) unique index
 * makes a concurrent duplicate a no-op. Inside an artist operation the write
 * is re-authorized under the artist row lock. Outside one it runs in a single
 * transaction with its activity record, so a failed audit rolls the source back.
 *
 * @param data - The source.
 * @returns The stored source with its activity, or undefined when it already existed. Throws on a failed write.
 */
export async function insertVaultSource(
  data: VaultSourceInput,
): Promise<(VaultSource & { activityId: string | null }) | undefined> {
  try {
    const url = canonicalizeLoreUrl(data.url) ?? data.url;
    return getArtistOperationOwnership(data.artistId)
      ? await withScopedArtistWrite(data.artistId, tx => writeVaultSource(tx, data, url))
      : await db.transaction(async tx => {
          await lockArtistRow(tx, data.artistId);
          return writeVaultSource(tx, data, url);
        });
  } catch (e) {
    console.error("[insertVaultSource] Error:", e);
    throw e;
  }
}
