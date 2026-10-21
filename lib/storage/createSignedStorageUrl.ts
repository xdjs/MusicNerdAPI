import { storageFetch } from "@/lib/storage/storageFetch";

/**
 * A time-limited URL for a private object, like supabase-js's `createSignedUrl`.
 *
 * @param bucket - The bucket.
 * @param path - The object path inside the bucket.
 * @param expiresIn - Seconds until the URL stops working.
 * @returns The absolute signed URL; throws on a Storage error.
 */
export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresIn: number,
): Promise<string> {
  const response = await storageFetch(`object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!response.ok) throw new Error(`Storage sign failed: HTTP ${response.status}`);
  const { signedURL } = (await response.json()) as { signedURL: string };
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1${signedURL}`;
}
