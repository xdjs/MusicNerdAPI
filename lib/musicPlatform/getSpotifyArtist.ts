import { mapSpotifyArtist } from "@/lib/musicPlatform/mapSpotifyArtist";
import type { MusicPlatformArtist, SpotifyArtistPayload } from "@/lib/musicPlatform/types";
import { getSpotifyHeaders } from "@/lib/spotify/getSpotifyHeaders";
import { readSpotifyJson } from "@/lib/spotify/readSpotifyJson";

/**
 * A Spotify artist with its release count and top track. The two extra calls
 * are best-effort: a failure defaults them rather than losing the artist.
 *
 * @param id - The Spotify artist id.
 * @returns The artist, or null when Spotify can't return a named artist. Throws when Spotify isn't configured.
 */
export async function getSpotifyArtist(id: string): Promise<MusicPlatformArtist | null> {
  const headers = await getSpotifyHeaders();
  let data: Partial<SpotifyArtistPayload>;
  try {
    data = (await readSpotifyJson(
      `https://api.spotify.com/v1/artists/${id}`,
      headers,
    )) as Partial<SpotifyArtistPayload>;
  } catch (e) {
    console.error("[getSpotifyArtist] Could not read artist", id, (e as Error)?.message);
    return null;
  }
  if (!data?.name || !data.id) return null;
  const artist: SpotifyArtistPayload = {
    id: data.id,
    name: data.name,
    images: Array.isArray(data.images) ? data.images : [],
    genres: Array.isArray(data.genres) ? data.genres : [],
    followers: data.followers || { total: 0 },
    external_urls: data.external_urls ?? { spotify: "" },
  };
  const [releases, tracks] = await Promise.allSettled([
    readSpotifyJson(
      `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album%2Csingle`,
      headers,
    ),
    readSpotifyJson(`https://api.spotify.com/v1/artists/${id}/top-tracks`, headers),
  ]);
  const albumCount = releases.status === "fulfilled" ? Number(releases.value.total ?? 0) : 0;
  const topTrackName =
    tracks.status === "fulfilled"
      ? ((tracks.value.tracks as { name?: string }[] | undefined)?.[0]?.name ?? null)
      : null;
  return mapSpotifyArtist(artist, albumCount, topTrackName);
}
