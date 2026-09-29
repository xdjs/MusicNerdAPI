import { normalizeLoreDiscoveryUrl } from "@/lib/sources/normalizeLoreDiscoveryUrl";
import { getVaultSourcesByStatus } from "@/lib/vault/getVaultSourcesByStatus";

/**
 * The URLs already in the artist's vault, normalized. Rejected ones count: a
 * rejection is the most reliable signal of who an artist is NOT, and
 * re-offering it reads as not listening. A deleted row is gone from the table,
 * so a deleted URL stays re-discoverable.
 *
 * @param artistId - The artist.
 * @returns Every pending, approved and rejected URL, and the rejected ones on their own.
 */
export async function readExistingUrls(
  artistId: string,
): Promise<{ existingUrls: Set<string>; rejectedUrls: Set<string> }> {
  const [pending, approved, rejected] = await Promise.all([
    getVaultSourcesByStatus(artistId, "pending"),
    getVaultSourcesByStatus(artistId, "approved"),
    getVaultSourcesByStatus(artistId, "rejected"),
  ]);
  return {
    existingUrls: new Set(
      [...pending, ...approved, ...rejected].map(s => normalizeLoreDiscoveryUrl(s.url)),
    ),
    rejectedUrls: new Set(rejected.map(s => normalizeLoreDiscoveryUrl(s.url))),
  };
}
