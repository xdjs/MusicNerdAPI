import type { PhotoChoiceArtist, PhotoSource } from "@/lib/artistImages/types";
import { getDeezerArtist } from "@/lib/musicPlatform/getDeezerArtist";
import { getSpotifyArtistImage } from "@/lib/musicPlatform/getSpotifyArtistImage";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";

/**
 * Resolves only the requested, already-linked provider's photo. No arbitrary
 * URL fetching, and only an `https` URL without credentials is returned.
 *
 * @param artist - The artist's linked provider ids.
 * @param source - Which provider.
 * @returns The photo URL, or null when the provider isn't linked or has none.
 */
export async function getProviderPhoto(
  artist: PhotoChoiceArtist,
  source: PhotoSource,
): Promise<string | null> {
  const id = artist[source]?.trim();
  if (!id) return null;
  try {
    const image =
      source === "deezer"
        ? (await getDeezerArtist(id))?.imageUrl
        : await getSpotifyArtistImage(id, await getSpotifyHeaders().catch(() => null));
    if (!image) return null;
    const url = new URL(image);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
