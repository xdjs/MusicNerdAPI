import { storageRequest } from "@/lib/storage/storageRequest";

/**
 * Reads one object's bytes with the service role, from any bucket.
 *
 * @param bucket - The bucket.
 * @param path - The object's key.
 * @returns The bytes; throws when the object is missing or storage refuses.
 */
export async function downloadObject(bucket: string, path: string): Promise<Buffer> {
  const response = await storageRequest(`object/${bucket}/${path}`, { method: "GET" });
  return Buffer.from(await response.arrayBuffer());
}
