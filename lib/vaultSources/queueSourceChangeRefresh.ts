import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";

/**
 * Queues the Lore refresh a source change calls for. The change is already
 * saved, so a failed enqueue is logged, not reported: Look again retries it.
 *
 * @param artistId - The artist.
 * @param expectedClaimId - The claim the change was made under.
 * @param userId - Who made the change.
 * @returns Nothing; never throws.
 */
export async function queueSourceChangeRefresh(
  artistId: string,
  expectedClaimId: string | null,
  userId: string,
): Promise<void> {
  try {
    await queueLoreRefresh(artistId, expectedClaimId, { userId, trigger: "source_change" });
  } catch (error) {
    console.error("[vault] Source saved but Lore enqueue failed", error);
  }
}
