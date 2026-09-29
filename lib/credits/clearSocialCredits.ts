import { eq } from "drizzle-orm";
import { writeForJob } from "@/lib/credits/writeForJob";
import { artistSocialCredits } from "@/lib/db/schema";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Wipes an artist's extraction. Called once when a full re-read starts, never
 * per slice, or every slice would erase the one before it.
 *
 * @param artistId - The artist.
 * @param jobId - The job doing it, for the write guard.
 * @returns Nothing; a database error is logged, a cancellation is rethrown.
 */
export async function clearSocialCredits(artistId: string, jobId?: string): Promise<void> {
  if (!artistId) return;
  try {
    await writeForJob(artistId, jobId, async tx => {
      await tx.delete(artistSocialCredits).where(eq(artistSocialCredits.artistId, artistId));
    });
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw e;
    console.error("[clearSocialCredits] Error:", e);
  }
}
