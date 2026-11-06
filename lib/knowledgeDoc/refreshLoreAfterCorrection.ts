import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";

/**
 * Queues the Lore rebuild a saved or undone correction calls for, attributed
 * to the user. The correction is already saved, so a failed enqueue is logged
 * and never reported as a failed save: Look again can retry the rebuild.
 *
 * @param artistId - The artist.
 * @param expectedClaimId - The claim the request started under.
 * @param userId - The acting user.
 * @returns Nothing.
 */
export async function refreshLoreAfterCorrection(
  artistId: string,
  expectedClaimId: string | null,
  userId: string,
): Promise<void> {
  try {
    await queueLoreRefresh(artistId, expectedClaimId, { userId, trigger: "lore_correction" });
  } catch (error) {
    console.error("[knowledge-doc/corrections] Correction saved; Lore enqueue failed", error);
  }
}
