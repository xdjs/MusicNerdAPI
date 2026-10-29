import type { AddArtistCandidate } from "@/lib/addArtist/types";
import { customImageUrl } from "@/lib/artists/customImageUrl";

/**
 * An artist row as a candidate to offer: id, name, catalog ids, and their
 * uploaded image when there is one.
 *
 * @param artist - The row's id, name, catalog ids and custom image.
 * @returns The candidate.
 */
export function toAddArtistCandidate(artist: {
  id: string;
  name: string | null;
  spotify: string | null;
  deezer: string | null;
  customImage?: string | null;
}): AddArtistCandidate {
  const imageUrl = customImageUrl(artist.customImage);
  return {
    ...(imageUrl ? { imageUrl } : {}),
    id: artist.id,
    name: artist.name,
    spotify: artist.spotify,
    deezer: artist.deezer,
  };
}
