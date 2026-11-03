import { VAULT_BUCKET } from "@/lib/storage/const";
import { downloadObject } from "@/lib/storage/downloadObject";
import { uploadStorageObject } from "@/lib/storage/uploadStorageObject";

/** Publish once; reconcile concurrent retry/lost acknowledgement without overwriting bytes. */
export async function publishImmutableUpload(
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  try {
    await uploadStorageObject(VAULT_BUCKET, path, bytes, {
      contentType,
      upsert: false,
      cacheControl: "3600",
    });
  } catch (error) {
    const existing = await downloadObject(VAULT_BUCKET, path);
    if (!existing.equals(bytes)) throw error;
  }
}
