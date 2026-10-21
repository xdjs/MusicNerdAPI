import { db } from "@/lib/db/db";
import { findApprovedClaim } from "@/lib/ownership/findApprovedClaim";

/**
 * The claim generation an operation starts under: the approved claim's id,
 * or null for an unclaimed artist. Captured before any work, so a replacement
 * claim made meanwhile is seen as a new generation by the claim-checked writes.
 *
 * @param artistId - The artist.
 * @returns The approved claim's id, or null.
 */
export async function getLoreClaimGeneration(artistId: string): Promise<string | null> {
  const claim = await findApprovedClaim(db, artistId);
  return claim?.id ?? null;
}
