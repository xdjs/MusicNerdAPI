import { VAULT_BUCKET } from "@/lib/instagram/const";

/**
 * The public URL of an object in the vault bucket, as Supabase's
 * `getPublicUrl` would build it. This is what `artists.custom_image` stores.
 *
 * @param storagePath - The object path inside the bucket.
 * @returns The public URL.
 */
export function profileImagePublicUrl(storagePath: string): string {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return encodeURI(`${supabaseUrl}/storage/v1/object/public/${VAULT_BUCKET}/${storagePath}`);
}
