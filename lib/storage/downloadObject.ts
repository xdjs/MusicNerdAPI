import { storageFetch } from "@/lib/storage/storageFetch";

/**
 * Reads one object's bytes with the service role, from any bucket.
 *
 * @param bucket - The bucket.
 * @param path - The object's key.
 * @returns The bytes; throws when the object is missing or storage refuses.
 */
export async function downloadObject(bucket: string, path: string): Promise<Buffer> {
  const response = await storageFetch(`object/${bucket}/${path}`, { method: "GET" });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
