import { getDeezerArtist } from "@/lib/musicPlatform/getDeezerArtist";
import { getSpotifyArtist } from "@/lib/musicPlatform/getSpotifyArtist";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * The artist's music-platform data: Deezer first, Spotify when Deezer has
 * nothing or fails, as in MusicNerdWeb. Never throws.
 *
 * @param artist - The artist's platform ids.
 * @param artist.deezer - Their Deezer id.
 * @param artist.spotify - Their Spotify id.
 * @returns The platform artist, or null.
 */
export async function getArtistPlatformData(artist: {
  deezer?: string | null;
  spotify?: string | null;
}): Promise<MusicPlatformArtist | null> {
  const deezerId = artist.deezer?.trim() || null;
  const spotifyId = artist.spotify?.trim() || null;
  if (deezerId) {
    try {
      const found = await getDeezerArtist(deezerId);
      if (found) return found;
    } catch (e) {
      console.error("[getArtistPlatformData] Deezer failed, trying Spotify:", e);
    }
  }
  if (!spotifyId) return null;
  try {
    return await getSpotifyArtist(spotifyId);
  } catch (e) {
    console.error("[getArtistPlatformData] Spotify failed:", e);
    return null;
  }
}
