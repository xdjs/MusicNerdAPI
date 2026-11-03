import { removeStagedUpload } from "@/lib/vaultUpload/removeStagedUpload";

/**
 * Invokes the staging lifecycle hook after a saved upload. Physical deletion
 * is currently deferred; this does not assert cleanup. Future hook failures
 * must not turn a committed upload into a reported failure.
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
