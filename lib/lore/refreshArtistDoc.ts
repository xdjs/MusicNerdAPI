import { generateLoreSummary } from "@/lib/lore/generateLoreSummary";
import { getArtistDoc } from "@/lib/lore/getArtistDoc";
import { getLoreClaimGeneration } from "@/lib/lore/getLoreClaimGeneration";
import { persistRefreshedLore } from "@/lib/lore/persistRefreshedLore";
import { synthesizeArtistDoc } from "@/lib/lore/synthesizeArtistDoc";
import type { DocRefresh } from "@/lib/lore/types";

/**
 * Rebuilds the artist's Lore from their current sources. Does not touch the
 * About, which belongs to the artist. Never throws.
 *
 * @param artistId - The artist.
 * @param options - How the rebuild is fenced.
 * @param options.createIfMissing - Write a document even when the artist has none yet.
 * @param options.jobId - The lore_refresh job doing the write; the write is skipped if it is gone.
 * @param options.expectedClaimId - The claim the job was queued under; read now when omitted.
 * @returns "rebuilt", "no-document" (nothing to rebuild), "cancelled" (ownership changed) or "failed".
 */
export async function refreshArtistDoc(
  artistId: string,
  options: { createIfMissing?: boolean; jobId?: string; expectedClaimId?: string | null } = {},
): Promise<DocRefresh> {
  try {
    const claimId =
      options.expectedClaimId !== undefined
        ? options.expectedClaimId
        : await getLoreClaimGeneration(artistId);
    if (!options.createIfMissing && !(await getArtistDoc(artistId))) return "no-document";
    const [{ doc, sources }, summary] = await Promise.all([
      synthesizeArtistDoc(artistId),
      generateLoreSummary(artistId),
    ]);
    if (!(await persistRefreshedLore(artistId, doc, sources, claimId, options.jobId, summary)))
      return "cancelled";
    console.log(`[refreshArtistDoc] Rebuilt doc for ${artistId} from ${sources.length} sources`);
    return "rebuilt";
  } catch (e) {
    console.error("[refreshArtistDoc] Failed:", e);
    return "failed";
  }
}
