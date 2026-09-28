import type { ThumbnailUploadScope } from "@/lib/instagram/types";
import { THUMBNAIL_TIMEOUT_MS, UUID, VAULT_BUCKET } from "@/lib/instagram/const";

/**
 * Removes a revoked job's late uploads after it lost its guarded write. Only
 * paths this code generated for that job are accepted, never scraper metadata.
 *
 * @param artistId - The artist whose claim was revoked.
 * @param scope - The revoked job and the paths it tried to upload.
 * @returns Nothing; throws if a path is outside the job or storage refuses.
 */
export async function removeRevokedInstagramThumbnails(
  artistId: string,
  scope: ThumbnailUploadScope,
): Promise<void> {
  if (!scope.attemptedPaths.size) return;
  if (!UUID.test(artistId) || !UUID.test(scope.jobId)) {
    throw new Error("Invalid thumbnail cleanup scope");
  }
  const prefix = `${artistId}/instagram-${scope.jobId}-`;
  const paths = [...scope.attemptedPaths];
  const outside = (path: string) =>
    !path.startsWith(prefix) || !/^\d+-[a-f0-9]{64}\.webp$/.test(path.slice(prefix.length));
  if (paths.some(outside)) throw new Error("Invalid thumbnail cleanup path");
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${VAULT_BUCKET}`, {
    method: "DELETE",
    redirect: "error",
    signal: AbortSignal.timeout(THUMBNAIL_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) throw new Error("Revoked Instagram thumbnail cleanup failed");
}
