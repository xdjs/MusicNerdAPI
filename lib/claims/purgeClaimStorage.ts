import { VAULT_BUCKET } from "@/lib/storage/const";
import { listStorageObjects } from "@/lib/storage/listStorageObjects";
import { removeObjects } from "@/lib/storage/removeObjects";

const PAGE_SIZE = 1000;
/** A ceiling on pages: 100,000 files for one artist would be a bug. */
const MAX_PAGES = 100;

/**
 * Deletes a revoked claimant's stored files: the artist's vault folder and
 * their profile images, which share a folder with every other artist's and
 * are matched by the `<artistId>_` prefix. Best effort after the revoke has
 * committed: it logs a failure and never throws.
 *
 * @param artistId - The artist.
 * @returns Once purged, or once the failure is logged.
 */
export async function purgeClaimStorage(artistId: string): Promise<void> {
  try {
    let vaultRemoved = 0;
    for (let i = 0; i < MAX_PAGES; i++) {
      // Removing shifts the listing, so every page is read from the start.
      const files = await listStorageObjects(VAULT_BUCKET, artistId, {
        limit: PAGE_SIZE,
        search: "",
      });
      if (files.length === 0) break;
      await removeObjects(
        VAULT_BUCKET,
        files.map(f => `${artistId}/${f.name}`),
      );
      vaultRemoved += files.length;
      if (files.length < PAGE_SIZE) break;
    }
    const prefix = `${artistId}_`;
    let profileRemoved = 0;
    for (let i = 0; i < MAX_PAGES; i++) {
      const files = await listStorageObjects(VAULT_BUCKET, "profile-images", {
        limit: PAGE_SIZE,
        search: prefix,
      });
      // `search` matches anywhere in the name; keep only this artist's own files.
      const own = files.filter(f => f.name.startsWith(prefix));
      if (own.length === 0) break;
      await removeObjects(
        VAULT_BUCKET,
        own.map(f => `profile-images/${f.name}`),
      );
      profileRemoved += own.length;
      if (files.length < PAGE_SIZE) break;
    }
    if (vaultRemoved + profileRemoved > 0)
      console.log(
        `[claims] Purged ${vaultRemoved} vault + ${profileRemoved} profile-image objects for artist ${artistId}`,
      );
  } catch (e) {
    console.error("[claims] Storage cleanup error:", e);
  }
}
