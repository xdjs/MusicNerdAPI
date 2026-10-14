import { assertDirectoryDiscoveryScope } from "@/lib/ownership/assertDirectoryDiscoveryScope";
import { rowsOf } from "@/lib/db/rowsOf";
import { and, eq, sql } from "drizzle-orm";
import { db, type WriteDb } from "@/lib/db/db";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { artistResearchJobs } from "@/lib/db/schema";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Runs one short write under the artist's row lock, only while the job still
 * exists. Revoking a claim deletes the artist's jobs under the same lock, so a
 * job whose claim was revoked can never write after the revocation. Only the
 * database write is locked, never scraping or uploads.
 *
 * @param artistId - The artist.
 * @param jobId - The job doing the write.
 * @param write - The write, given the transaction.
 * @returns What `write` returns; throws OwnershipChangedError if the job is gone.
 */
export async function withResearchJobWrite<T>(
  artistId: string,
  jobId: string,
  write: (tx: WriteDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async tx => {
    await lockArtistRow(tx, artistId);
    const job = await tx.query.artistResearchJobs.findFirst({
      where: and(eq(artistResearchJobs.id, jobId), eq(artistResearchJobs.artistId, artistId)),
    });
    if (!job) throw new OwnershipChangedError();
    const state = job.state as Record<string, unknown> | undefined;
    if (state && "directoryActivityId" in state)
      await assertDirectoryDiscoveryScope(
        tx,
        artistId,
        typeof state.directoryActivityId === "string" ? state.directoryActivityId : undefined,
      );
    if (state && "resumedFromDirectoryJobId" in state) {
      const claim = await tx.execute(
        sql`select id from artist_claims where id=${state.claimId}::uuid and artist_id=${artistId}::uuid and status='approved'`,
      );
      if (!rowsOf(claim).length) throw new OwnershipChangedError();
    }
    return write(tx);
  });
}
