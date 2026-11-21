import type { MusicPlatform } from "@/lib/musicPlatform/types";

/**
 * Is this id safe to look up? Deezer ids are digits; Spotify ids are base-62.
 *
 * @param platform - The platform.
 * @param platformId - The id.
 * @returns True when well-formed.
 */
export function isCatalogPlatformId(platform: MusicPlatform, platformId: string): boolean {
  return platform === "deezer" ? /^\d+$/.test(platformId) : /^[A-Za-z0-9]+$/.test(platformId);
}
