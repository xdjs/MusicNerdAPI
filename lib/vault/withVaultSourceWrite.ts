import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistVaultSources } from "@/lib/db/schema";
import { getActiveArtistOperation } from "@/lib/ownership/getActiveArtistOperation";
import type { ScopedWriteDb } from "@/lib/ownership/types";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";

/**
 * A write to one vault source. Inside an artist operation it re-checks the
 * claim under the artist row lock and only matches that artist's source;
 * outside one it still locks the source's artist and commits source, audit and job together.
 *
 * @param sourceId - The vault source.
 * @param write - The write, given the client and the row predicate to use.
 * @returns What `write` returns; a changed claim throws.
 */
export async function withVaultSourceWrite<T>(
  sourceId: string,
  write: (tx: ScopedWriteDb, predicate: SQL) => Promise<T>,
): Promise<T> {
  const scope = getActiveArtistOperation();
  if (!scope)
    return db.transaction(async tx => {
      const [source] = await tx.execute<{ artist_id: string }>(
        sql`select artist_id from artist_vault_sources where id=${sourceId}::uuid`,
      );
      if (source) await lockArtistRow(tx, source.artist_id);
      return write(
        tx,
        source
          ? and(
              eq(artistVaultSources.id, sourceId),
              eq(artistVaultSources.artistId, source.artist_id),
            )!
          : sql`false`,
      );
    });
  return withScopedArtistWrite(scope.artistId, tx =>
    write(
      tx,
      and(eq(artistVaultSources.id, sourceId), eq(artistVaultSources.artistId, scope.artistId))!,
    ),
  );
}
