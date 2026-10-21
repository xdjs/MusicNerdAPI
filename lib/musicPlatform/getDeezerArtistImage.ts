import { fetchDeezerArtist } from "@/lib/musicPlatform/fetchDeezerArtist";

/**
 * A Deezer artist's medium (250 px) picture, the thumbnail size, as
 * MusicNerdWeb's `DeezerProvider.getArtistImage` returned it.
 *
 * @param id - The Deezer artist id.
 * @returns The picture URL, or null.
 */
export async function getDeezerArtistImage(id: string): Promise<string | null> {
  const artist = await fetchDeezerArtist(id);
  if (!artist) return null;
  return artist.picture_medium || null;
}
