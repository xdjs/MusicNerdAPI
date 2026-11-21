import type { MusicPlatform } from "@/lib/musicPlatform/types";

/**
 * Is this a well-formed platform artist id, as MusicBrainz URLs carry them?
 * Deezer ids are digits; Spotify ids are 22 base-62 characters.
 *
 * @param platform - The platform.
 * @param platformId - The id.
 * @returns True when well-formed.
 */
export function isMusicBrainzPlatformId(platform: MusicPlatform, platformId: string): boolean {
  return platform === "deezer" ? /^\d+$/.test(platformId) : /^[A-Za-z0-9]{22}$/.test(platformId);
}
