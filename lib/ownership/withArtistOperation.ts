import { artistOperations } from "@/lib/ownership/artistOperations";
import type { ArtistOperationOwnership } from "@/lib/ownership/types";

/**
 * Runs an operation with its ownership in context, so every scoped write it
 * makes re-checks the claim. Carries authorization, never a transaction.
 *
 * @param artistId - The artist the operation is scoped to.
 * @param ownership - Who it runs as, and under which claim.
 * @param operation - The work.
 * @returns What the operation returns.
 */
export function withArtistOperation<T>(
  artistId: string,
  ownership: ArtistOperationOwnership,
  operation: () => T,
): T {
  return artistOperations.run({ ...ownership, artistId }, operation);
}
