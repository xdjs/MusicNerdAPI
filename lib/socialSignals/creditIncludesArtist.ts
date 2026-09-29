import { nameTokens } from "@/lib/socialSignals/nameTokens";

/**
 * Whether a post's track credit names the artist. A track credited to someone
 * else ("Los Caracuchos" under a recipe post) is background audio, not a music
 * signal about the artist.
 *
 * @param musicArtist - The credit on the post.
 * @param artistNameTokens - The artist's name words; empty means "cannot verify", which passes.
 * @returns True when every word of the artist's name is in the credit.
 */
export function creditIncludesArtist(musicArtist: string, artistNameTokens: Set<string>): boolean {
  if (artistNameTokens.size === 0) return true;
  const creditTokens = nameTokens(musicArtist);
  for (const token of artistNameTokens) {
    if (!creditTokens.has(token)) return false;
  }
  return true;
}
