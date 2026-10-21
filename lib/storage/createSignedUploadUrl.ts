import { storageRequest } from "@/lib/storage/storageRequest";

/**
 * A signed URL a browser can `PUT` one object to, without credentials.
 *
 * @param bucket - The bucket.
 * @param path - The object's key.
 * @returns The absolute signed upload URL; throws when storage refuses.
 */
export async function createSignedUploadUrl(bucket: string, path: string): Promise<string> {
  const response = await storageRequest(`object/upload/sign/${bucket}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = (await response.json()) as { url?: string };
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const url = new URL(`${supabaseUrl}/storage/v1${data.url ?? ""}`);
  if (!url.searchParams.get("token")) throw new Error("No token returned by API");
  return url.toString();
}
