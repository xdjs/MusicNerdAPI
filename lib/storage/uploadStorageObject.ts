import { storageFetch } from "@/lib/storage/storageFetch";

/**
 * Stores bytes as an object, like supabase-js's `upload`.
 *
 * @param bucket - The bucket.
 * @param path - The object path inside the bucket.
 * @param body - The bytes.
 * @param options - The object's content type, whether to replace an existing object, and its cache lifetime in seconds.
 * @param options.contentType - The stored content type.
 * @param options.upsert - True to replace an existing object at `path`.
 * @param options.cacheControl - The `max-age` the object is served with.
 * @returns Nothing; throws on a Storage error.
 */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  body: Buffer,
  options: { contentType: string; upsert: boolean; cacheControl: string },
): Promise<void> {
  const response = await storageFetch(`object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": options.contentType,
      "Cache-Control": `max-age=${options.cacheControl}`,
      "x-upsert": String(options.upsert),
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) throw new Error(`Storage upload failed: HTTP ${response.status}`);
}
