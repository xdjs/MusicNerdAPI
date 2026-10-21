import { storageRequest } from "@/lib/artistImages/storageRequest";
import { VAULT_BUCKET } from "@/lib/instagram/const";

/**
 * Stores one profile image in the vault bucket, never overwriting: the path
 * carries a timestamp, so a name clash means a concurrent upload.
 *
 * @param storagePath - The object path inside the bucket.
 * @param body - The image bytes.
 * @param contentType - The image's declared type.
 * @returns True when storage accepted it; false, after logging, when it refused.
 */
export async function uploadProfileImage(
  storagePath: string,
  body: Buffer,
  contentType: string,
): Promise<boolean> {
  const response = await storageRequest(`object/${VAULT_BUCKET}/${storagePath}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "max-age=3600",
      "x-upsert": "false",
    },
    body: new Uint8Array(body),
  });
  if (response.ok) return true;
  const error = await response.json().catch(() => null);
  console.error("[artist/profile-image] Supabase upload error:", response.status, error);
  return false;
}
