import { titleMatchesArtist } from "@/lib/artists/titleMatchesArtist";
import type { LinkPreview } from "@/lib/pages/types";

/**
 * Does a preview look like the artist? A title naming someone else is a miss
 * even with an image; with no title, an image alone is a hit. Callers pass the
 * stripped residual as the title, never the raw one.
 *
 * @param preview - The preview, with the residual title.
 * @param artistName - The artist's name.
 * @returns True for a hit.
 */
export function isProbeHit(preview: LinkPreview, artistName: string): boolean {
  if (preview.title && !titleMatchesArtist(preview.title, artistName)) return false;
  return !!(preview.imageUrl || preview.title);
}
