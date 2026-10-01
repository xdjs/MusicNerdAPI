import type { MusicPlatformArtist, SpotifyArtistPayload } from "@/lib/musicPlatform/types";

/**
 * A Spotify artist in the shared platform shape.
 *
 * @param artist - The Spotify artist.
 * @param albumCount - Its release count.
 * @param topTrackName - Its top track's name, or null.
 * @returns The normalized artist.
 */
export function mapSpotifyArtist(
  artist: SpotifyArtistPayload,
  albumCount: number,
  topTrackName: string | null,
): MusicPlatformArtist {
  return {
    platform: "spotify",
    platformId: artist.id,
    name: artist.name,
    imageUrl: artist.images[0]?.url ?? null,
    followerCount: artist.followers.total,
    albumCount,
    genres: artist.genres,
    profileUrl: artist.external_urls.spotify,
    topTrackName,
  };
}
