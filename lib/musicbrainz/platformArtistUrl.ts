import type { MusicPlatform } from "@/lib/musicPlatform/types";

/**
 * The canonical artist URL MusicBrainz stores for a platform id.
 *
 * @param platform - The platform.
 * @param platformId - The id.
 * @returns The URL.
 */
export function platformArtistUrl(platform: MusicPlatform, platformId: string): string {
  return platform === "spotify"
    ? `https://open.spotify.com/artist/${platformId}`
    : `https://www.deezer.com/artist/${platformId}`;
}
