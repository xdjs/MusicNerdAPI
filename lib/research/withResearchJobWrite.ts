import { and, eq, sql } from "drizzle-orm";
import { db, type WriteDb } from "@/lib/db/db";
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
    await tx.execute(sql`select id from artists where id = ${artistId}::uuid for update`);
    const job = await tx.query.artistResearchJobs.findFirst({
      where: and(eq(artistResearchJobs.id, jobId), eq(artistResearchJobs.artistId, artistId)),
    });
    if (!job) throw new OwnershipChangedError();
    return write(tx);
  });
}
