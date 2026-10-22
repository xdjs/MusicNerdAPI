import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { db } from "@/lib/db/db";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import type { ArtistWriteAuth } from "@/lib/ownership/types";
import { withArtistUploadWrite } from "@/lib/ownership/withArtistUploadWrite";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import { canonicalizeLoreUrl } from "@/lib/sources/canonicalizeLoreUrl";
import type { SourceProvenance, VaultSource, VaultSourceInput } from "@/lib/vault/types";
import { writeVaultSource } from "@/lib/vault/writeVaultSource";

/**
 * Adds a source to the artist's vault, once: the (artist_id, url) unique index
 * makes a concurrent duplicate a no-op. An upload passes who is uploading and
 * the claim it started under, and is re-authorized under the artist row lock.
 * Otherwise, inside an artist operation the write is re-authorized the same
 * way; outside one it runs in a single transaction with its activity record,
 * so a failed audit rolls the source back.
 *
 * @param data - The source.
 * @param provenance - Who submitted it and why, for a source a user sent in.
 * @param authorization - For an upload: the user and the expected claim.
 * @returns The stored source with its activity, or undefined when it already existed. Throws on a failed write.
 */
export async function insertVaultSource(
  data: VaultSourceInput,
  provenance?: SourceProvenance,
  authorization?: ArtistWriteAuth,
): Promise<(VaultSource & { activityId: string | null }) | undefined> {
  try {
    const url = canonicalizeLoreUrl(data.url) ?? data.url;
    return authorization
      ? await withArtistUploadWrite(
          data.artistId,
          authorization.userId,
          authorization.expectedClaimId,
          tx => writeVaultSource(tx, data, url, provenance),
        )
      : getArtistOperationOwnership(data.artistId)
        ? await withScopedArtistWrite(data.artistId, tx =>
            writeVaultSource(tx, data, url, provenance),
          )
        : await db.transaction(async tx => {
            await lockArtistRow(tx, data.artistId);
            return writeVaultSource(tx, data, url, provenance);
          });
  } catch (e) {
    console.error("[insertVaultSource] Error:", e);
    throw e;
  }
}
