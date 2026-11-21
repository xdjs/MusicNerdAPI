import type { CatalogArtistIdentity } from "@/lib/catalogIdentity/types";
import { fetchDeezerArtist } from "@/lib/musicPlatform/fetchDeezerArtist";
import type { MusicPlatform } from "@/lib/musicPlatform/types";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { readSpotifyJson } from "@/lib/spotify/readSpotifyJson";

/**
 * An artist's canonical id and name on Spotify or Deezer: the one request
 * adding an artist needs, without the release and top-track calls.
 *
 * @param platform - The platform.
 * @param platformId - The submitted id.
 * @returns The identity, or null when the platform has no named artist for it. Throws when Spotify isn't configured.
 */
export async function getArtistIdentity(
  platform: MusicPlatform,
  platformId: string,
): Promise<CatalogArtistIdentity | null> {
  if (platform === "deezer") {
    const artist = await fetchDeezerArtist(platformId);
    return artist?.name ? { platform, platformId: String(artist.id), name: artist.name } : null;
  }
  const headers = await getSpotifyHeaders();
  try {
    const data = await readSpotifyJson(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(platformId)}`,
      headers,
    );
    return typeof data.id === "string" && typeof data.name === "string" && data.name
      ? { platform, platformId: data.id, name: data.name }
      : null;
  } catch (e) {
    console.error("[getArtistIdentity] Could not read Spotify artist", (e as Error)?.message);
    return null;
  }
}
