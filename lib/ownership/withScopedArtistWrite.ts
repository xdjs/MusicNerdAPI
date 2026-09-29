import { db } from "@/lib/db/db";
import { getArtistOperationOwnership } from "@/lib/ownership/getArtistOperationOwnership";
import { lockScopedArtistWrite } from "@/lib/ownership/lockScopedArtistWrite";
import type { ScopedWriteDb } from "@/lib/ownership/types";

/**
 * One short write, re-authorized under the artist row lock when an operation
 * is running. A long operation re-checks ownership per write, never across its
 * network work. Outside an operation it writes with the plain client.
 *
 * @param artistId - The artist being written.
 * @param write - The write, given the transaction or client.
 * @returns What `write` returns; throws OwnershipChangedError if the claim changed.
 */
export async function withScopedArtistWrite<T>(
  artistId: string,
  write: (tx: ScopedWriteDb) => Promise<T>,
): Promise<T> {
  if (!getArtistOperationOwnership(artistId)) return write(db);
  return db.transaction(async tx => {
    await lockScopedArtistWrite(tx, artistId);
    return write(tx);
  });
}
