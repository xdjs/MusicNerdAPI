import { PROFILE_IMAGE_FOLDER, STALE_PROFILE_IMAGE_GRACE_MS } from "@/lib/artistImages/const";
import { listProfileImages } from "@/lib/artistImages/listProfileImages";
import { removeProfileImages } from "@/lib/artistImages/removeProfileImages";

/**
 * Best-effort: removes the artist's older profile images once a new one is
 * live. Without this every save leaves an orphaned object. Runs after the
 * artist row is updated, so a purge failure can never leave the artist with a
 * deleted image the database still points at. Never throws.
 *
 * @param artistId - The artist whose uploads to prune.
 * @param filename - The bare filename just uploaded, which is never removed.
 * @returns Nothing.
 */
export async function purgeStaleProfileImages(artistId: string, filename: string): Promise<void> {
  try {
    const files = await listProfileImages(artistId);
    // Exclude the file just uploaded AND anything within the grace window
    // (see STALE_PROFILE_IMAGE_GRACE_MS).
    const ageCutoff = Date.now() - STALE_PROFILE_IMAGE_GRACE_MS;
    const stale = files
      .filter(f => {
        if (!f.name.startsWith(`${artistId}_`)) return false;
        if (f.name === filename) return false;
        // `created_at` is ISO 8601; a missing or unparseable value drops to the
        // safe "skip" branch instead of silently bypassing the grace check.
        const createdAt = typeof f.created_at === "string" ? f.created_at : null;
        if (!createdAt) return false;
        const parsed = Date.parse(createdAt);
        if (Number.isNaN(parsed)) return false;
        return parsed < ageCutoff;
      })
      .map(f => `${PROFILE_IMAGE_FOLDER}/${f.name}`);
    if (stale.length > 0) {
      await removeProfileImages(stale);
      console.log(
        `[artist/profile-image] Purged ${stale.length} stale image(s) for artist ${artistId}`,
      );
    }
  } catch (e) {
    console.error("[artist/profile-image] Stale image cleanup error:", e);
  }
}
