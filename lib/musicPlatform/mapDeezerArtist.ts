import type { DeezerArtistPayload, MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * A Deezer artist in the shared platform shape. Deezer has genres on albums
 * only, so an artist's are empty.
 *
 * @param artist - The Deezer artist.
 * @param topTrackName - Its top track's title, or null.
 * @returns The normalized artist, with the 1000 px picture.
 */
export function mapDeezerArtist(
  artist: DeezerArtistPayload,
  topTrackName: string | null,
): MusicPlatformArtist {
  return {
    platform: "deezer",
    platformId: String(artist.id),
    name: artist.name,
    imageUrl: artist.picture_xl || null,
    followerCount: artist.nb_fan,
    albumCount: artist.nb_album,
    genres: [],
    profileUrl: artist.link,
    topTrackName,
  };
}
