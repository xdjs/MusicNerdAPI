import { getDeezerArtistImage } from "@/lib/musicPlatform/getDeezerArtistImage";
import { getSpotifyArtistImage } from "@/lib/musicPlatform/getSpotifyArtistImage";
import type { SpotifyHeaders } from "@/lib/spotify/types";

/**
 * The artist's thumbnail image as MusicNerdWeb's `musicPlatformData.getArtistImage`
 * resolved it: their own upload, else Spotify, else Deezer. Image preference
 * is independent from the Deezer-first catalog lookup. Never throws.
 *
 * @param artist - The artist's upload and platform ids.
 * @param artist.customImage - Their uploaded image.
 * @param artist.spotify - Their Spotify id.
 * @param artist.deezer - Their Deezer id.
 * @param headers - Spotify bearer headers, or null to skip Spotify's Web API.
 * @returns The image URL, or null.
 */
export async function getArtistImage(
  artist: { customImage?: string | null; spotify?: string | null; deezer?: string | null },
  headers: SpotifyHeaders | null,
): Promise<string | null> {
  const saved = artist.customImage?.trim();
  if (saved) return saved;
  const deezerId = artist.deezer?.trim() || null;
  const spotifyId = artist.spotify?.trim() || null;
  if (spotifyId) {
    try {
      const image = await getSpotifyArtistImage(spotifyId, headers);
      if (image?.trim()) return image.trim();
    } catch {
      /* Try the linked Deezer profile when Spotify is unavailable. */
    }
  }
  if (deezerId) {
    try {
      const image = await getDeezerArtistImage(deezerId);
      if (image?.trim()) return image.trim();
    } catch {
      /* No usable provider photo. */
    }
  }
  return null;
}
