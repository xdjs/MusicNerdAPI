import { artistOperations } from "@/lib/ownership/artistOperations";
import type { ArtistOperation } from "@/lib/ownership/types";

/**
 * The running operation's ownership, for a write to this artist.
 *
 * @param artistId - The artist being written.
 * @returns The ownership (with its artistId), or undefined outside an operation; throws if the operation is another artist's.
 */
export function getArtistOperationOwnership(artistId: string): ArtistOperation | undefined {
  const context = artistOperations.getStore();
  if (context && context.artistId !== artistId) throw new Error("Artist operation scope mismatch");
  return context;
}
