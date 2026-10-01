import { normalizeName } from "@/lib/discovery/normalizeName";
import type { MusicPlatformArtist } from "@/lib/musicPlatform/types";

/**
 * The artist's own result from a name search: an exact match, tie-broken by
 * followers. An ambiguous tie at the top proposes nothing.
 *
 * @param matches - The search results.
 * @param artistName - The artist's name.
 * @returns The match, or null.
 */
export function pickExactNameMatch(
  matches: MusicPlatformArtist[],
  artistName: string,
): MusicPlatformArtist | null {
  const target = normalizeName(artistName);
  const exact = matches.filter(m => normalizeName(m.name) === target);
  if (exact.length === 0) return null;
  exact.sort((a, b) => (b.followerCount ?? 0) - (a.followerCount ?? 0));
  if (exact.length > 1 && (exact[0].followerCount ?? 0) === (exact[1].followerCount ?? 0))
    return null;
  return exact[0];
}
