import { eq } from "drizzle-orm";
import { artists } from "@/lib/db/schema";
import { withScopedArtistWrite } from "@/lib/ownership/withScopedArtistWrite";
import type { LinkSection } from "@/lib/artistLinkOrder/types";

/**
 * Saves one link group's order on the artist, keeping the other group's. The
 * artist lock (inside an operation) also serializes saves of the two groups.
 *
 * @param artistId - The artist.
 * @param section - `links` or `support`.
 * @param order - Platform names in display order.
 * @returns True when saved, false when the artist doesn't exist.
 */
export async function saveArtistLinkOrder(
  artistId: string,
  section: LinkSection,
  order: string[],
): Promise<boolean> {
  return withScopedArtistWrite(artistId, async tx => {
    const artist = await tx.query.artists.findFirst({ where: eq(artists.id, artistId) });
    if (!artist) return false;
    await tx
      .update(artists)
      .set({ linkOrder: { ...artist.linkOrder, [section]: order } })
      .where(eq(artists.id, artistId));
    return true;
  });
}
