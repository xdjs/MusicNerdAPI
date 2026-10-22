import { queueLoreRefresh } from "@/lib/research/queueLoreRefresh";

/**
 * Queues the Lore refresh a saved upload calls for, attributed to the
 * uploader. The upload is already saved, so a failed enqueue becomes advice
 * for the user rather than an error.
 *
 * @param artistId - The artist.
 * @param expectedClaimId - The claim the upload started under.
 * @param userId - The uploader.
 * @returns A warning to show when the refresh could not be queued, else undefined.
 */
export async function refreshAfterUpload(
  artistId: string,
  expectedClaimId: string | null,
  userId: string,
): Promise<string | undefined> {
  try {
    await queueLoreRefresh(artistId, expectedClaimId, { userId, trigger: "upload" });
  } catch (error) {
    console.error("[vault/upload/complete] Saved upload; Lore enqueue failed", error);
    return "File saved. Lore refresh could not start; use Look again to retry. Do not upload the file again.";
  }
}
