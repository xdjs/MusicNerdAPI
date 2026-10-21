import { storageFetch } from "@/lib/storage/storageFetch";

/**
 * The objects in a bucket folder, like supabase-js's `storage.from(bucket).list`.
 *
 * @param bucket - The bucket.
 * @param prefix - The folder.
 * @param options - How many to return and a name search.
 * @param options.limit - At most this many objects.
 * @param options.search - Only names containing this.
 * @returns The objects; throws on a Storage error.
 */
export async function listStorageObjects(
  bucket: string,
  prefix: string,
  options: { limit: number; search: string },
): Promise<Array<{ name: string }>> {
  const response = await storageFetch(`object/list/${bucket}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: options.limit, search: options.search }),
  });
  if (!response.ok) throw new Error(`Storage list failed: HTTP ${response.status}`);
  return (await response.json()) as Array<{ name: string }>;
}
