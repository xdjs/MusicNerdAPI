import { storageRequest } from "@/lib/artistImages/storageRequest";
import { VAULT_BUCKET } from "@/lib/instagram/const";

/**
 * Removes stored profile images by their full object paths.
 *
 * @param paths - The object paths inside the bucket.
 * @returns Nothing; throws when storage refuses.
 */
export async function removeProfileImages(paths: string[]): Promise<void> {
  const response = await storageRequest(`object/${VAULT_BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) throw new Error(`Storage remove failed: HTTP ${response.status}`);
}
