import { db, type WriteDb } from "@/lib/db/db";
import { withResearchJobWrite } from "@/lib/research/withResearchJobWrite";

/**
 * Runs a credits write under the job's write guard when a job is doing it, so
 * a job whose claim was revoked cannot write; otherwise straight to the database.
 *
 * @param artistId - The artist.
 * @param jobId - The job doing the write, if any.
 * @param write - The write, given the transaction or the database.
 * @returns What `write` returns; throws OwnershipChangedError if the job is gone.
 */
export async function writeForJob<T>(
  artistId: string,
  jobId: string | undefined,
  write: (tx: WriteDb) => Promise<T>,
): Promise<T> {
  return jobId ? withResearchJobWrite(artistId, jobId, write) : write(db);
}
