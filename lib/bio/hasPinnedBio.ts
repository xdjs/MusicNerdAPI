import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/db";
import { artistBioVersions } from "@/lib/db/schema";

/**
 * Whether the artist has pinned a bio version. A failed read counts as not
 * pinned, as on MusicNerdWeb: the bio write re-checks the pin under the artist
 * row lock, so generated text never replaces a pinned bio either way.
 *
 * @param artistId - The artist.
 * @returns True when a version is pinned.
 */
export async function hasPinnedBio(artistId: string): Promise<boolean> {
  try {
    const pinned = await db.query.artistBioVersions.findFirst({
      columns: { id: true },
      where: and(eq(artistBioVersions.artistId, artistId), eq(artistBioVersions.isPinned, true)),
    });
    return !!pinned;
  } catch (e) {
    console.error("[hasPinnedBio] Error:", e);
    return false;
  }
}
