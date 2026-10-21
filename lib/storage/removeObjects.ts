import { storageFetch } from "@/lib/storage/storageFetch";

/**
 * Deletes objects by key.
 *
 * @param bucket - The bucket.
 * @param paths - The keys to delete.
 * @returns Nothing; throws when storage refuses.
 */
export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  const response = await storageFetch(`object/${bucket}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}`);
  }
}
