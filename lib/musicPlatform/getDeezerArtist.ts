import { fetchDeezerArtist } from "@/lib/musicPlatform/fetchDeezerArtist";
import { fetchDeezerTopTrack } from "@/lib/musicPlatform/fetchDeezerTopTrack";
import { mapDeezerArtist } from "@/lib/musicPlatform/mapDeezerArtist";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * A Deezer artist with its top track.
 *
 * @param id - The Deezer artist id.
 * @returns The artist, or null when Deezer can't return it.
 */
export async function getDeezerArtist(id: string): Promise<MusicPlatformArtist | null> {
  const [artist, topTrackName] = await Promise.all([
    fetchDeezerArtist(id),
    fetchDeezerTopTrack(id),
  ]);
  return artist ? mapDeezerArtist(artist, topTrackName) : null;
}
