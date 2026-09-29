import { toCreditRows } from "@/lib/credits/toCreditRows";
import type { CaptionExtraction } from "@/lib/credits/types";
import { writeForJob } from "@/lib/credits/writeForJob";
import { artistSocialCredits } from "@/lib/db/schema";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

/**
 * Adds what one slice found. Conflicts are ignored, so a sweep re-finding
 * something is harmless.
 *
 * @param artistId - The artist.
 * @param extraction - What the slice found.
 * @param postedAtByUrl - Each post's publication date, when stored.
 * @param jobId - The job doing it, for the write guard.
 * @returns Rows written, or null when the WRITE failed. Returning 0 for both let
 *   a caller advance its cursor past credits that were never stored.
 */
export async function appendSocialCredits(
  artistId: string,
  extraction: CaptionExtraction,
  postedAtByUrl?: Map<string, string | null>,
  jobId?: string,
): Promise<number | null> {
  if (!artistId) return 0;
  const rows = toCreditRows(artistId, extraction, postedAtByUrl);
  try {
    // Even an empty write goes through the guard, so a cancelled job finds out here.
    return await writeForJob(artistId, jobId, async tx => {
      if (rows.length === 0) return 0;
      await tx.insert(artistSocialCredits).values(rows).onConflictDoNothing();
      return rows.length;
    });
  } catch (e) {
    if (e instanceof OwnershipChangedError) throw e;
    console.error("[appendSocialCredits] Error:", e);
    return null;
  }
}
