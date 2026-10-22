import { removeStagedUpload } from "@/lib/vaultUpload/removeStagedUpload";

/**
 * Removes the staged copy of an upload that is already saved. A failure is
 * logged, never surfaced: the upload succeeded, and the staged object is only
 * a leftover.
 *
 * @param path - The staged object's key.
 * @returns Nothing.
 */
export async function cleanupSavedUpload(path: string): Promise<void> {
  try {
    await removeStagedUpload(path);
  } catch (error) {
    console.error("[vault/upload/complete] Staging cleanup failed", error);
  }
}
