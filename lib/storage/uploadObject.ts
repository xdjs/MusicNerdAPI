import { storageRequest } from "@/lib/storage/storageRequest";

/**
 * Writes one object. Without `upsert` an existing key is refused, as
 * `@supabase/supabase-js`'s `upload` does.
 *
 * @param bucket - The bucket.
 * @param path - The object's key.
 * @param body - The bytes.
 * @param contentType - The stored `Content-Type`.
 * @param options - `upsert` to overwrite an existing object.
 * @param options.upsert - Overwrite an existing object at the key.
 * @returns Nothing; throws when storage refuses.
 */
export async function uploadObject(
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string,
  options: { upsert?: boolean } = {},
): Promise<void> {
  await storageRequest(`object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "max-age=3600",
      "x-upsert": options.upsert ? "true" : "false",
    },
    body: new Uint8Array(body),
  });
}
