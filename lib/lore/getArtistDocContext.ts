import { ARTIST_DOC_CONTEXT_CAP } from "@/lib/lore/const";
import { getArtistDoc } from "@/lib/lore/getArtistDoc";
import { stripCitationMarkers } from "@/lib/lore/stripCitationMarkers";

/**
 * The capped slice of the artist's Lore document for prompt injection (fun
 * facts, Ask, the About), as in MusicNerdWeb. Its output is user-facing and has
 * no source list to resolve `[n]` against, so the markers are stripped before
 * the cap: stripping never lengthens text, but capping first could leave a
 * slice shorter than the cap.
 *
 * @param artistId - The artist.
 * @returns The plain-prose slice, or null when the artist has no document.
 */
export async function getArtistDocContext(artistId: string): Promise<string | null> {
  const doc = await getArtistDoc(artistId);
  if (!doc?.content) return null;
  return stripCitationMarkers(doc.content).slice(0, ARTIST_DOC_CONTEXT_CAP);
}
