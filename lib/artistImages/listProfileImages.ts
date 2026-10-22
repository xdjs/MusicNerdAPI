import { PROFILE_IMAGE_FOLDER } from "@/lib/artistImages/const";
import type { StorageObject } from "@/lib/artistImages/types";
import { VAULT_BUCKET } from "@/lib/storage/const";
import { storageFetch } from "@/lib/storage/storageFetch";

/**
 * The artist's uploaded profile images, as storage lists them. Storage's
 * `search` is a substring match, so callers re-anchor on the artist prefix.
 *
 * @param artistId - The artist whose uploads to list.
 * @returns The objects in the profile-images folder matching `<artistId>_`; throws when storage refuses.
 */
export async function listProfileImages(artistId: string): Promise<StorageObject[]> {
  const response = await storageFetch(`object/list/${VAULT_BUCKET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix: PROFILE_IMAGE_FOLDER,
      limit: 1000,
      offset: 0,
      search: `${artistId}_`,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!response.ok) throw new Error(`Storage list failed: HTTP ${response.status}`);
  const files: unknown = await response.json();
  return Array.isArray(files)
    ? files.filter((f): f is StorageObject => typeof f?.name === "string")
    : [];
}
