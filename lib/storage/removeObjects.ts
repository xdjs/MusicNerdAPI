import { storageRequest } from "@/lib/storage/storageRequest";

/**
 * Deletes objects by key.
 *
 * @param bucket - The bucket.
 * @param paths - The keys to delete.
 * @returns Nothing; throws when storage refuses.
 */
export async function removeObjects(bucket: string, paths: string[]): Promise<void> {
  await storageRequest(`object/${bucket}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
}
