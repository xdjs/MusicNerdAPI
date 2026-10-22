import { LORE_UPLOAD_BUCKET } from "@/lib/storage/const";
import { removeObjects } from "@/lib/storage/removeObjects";

/**
 * Deletes a staged upload, before or after it is published.
 *
 * @param path - The staged object's key.
 * @returns Nothing; throws when storage refuses, so the caller can keep the completion retryable.
 */
export async function removeStagedUpload(path: string): Promise<void> {
  await removeObjects(LORE_UPLOAD_BUCKET, [path]);
}
