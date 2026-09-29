import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * The tier-4 search query: the name, the first genre when known, and "music
 * artist" to steer away from same-named strangers.
 *
 * @param artistName - The artist's name.
 * @param enrichment - Their platform data, for a genre.
 * @returns The query.
 */
export function buildTierFourQuery(
  artistName: string,
  enrichment: MusicPlatformArtist | null,
): string {
  const parts = [artistName];
  if (enrichment?.genres?.[0]) parts.push(enrichment.genres[0]);
  parts.push("music artist");
  return parts.join(" ");
}
