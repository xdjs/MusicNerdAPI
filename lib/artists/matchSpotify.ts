import type { ExtractedArtistId } from "@/lib/artists/types";

/**
 * Reads a spotify match. Group 1 is the URL type, not the id; only an /artist/
 * URL with a 22-character base62 id identifies an artist.
 *
 * @param match - The urlmap regex match.
 * @param cardPlatformName - The row's display name.
 * @returns The reading, or null for anything that is not an artist profile.
 */
export function matchSpotify(
  match: RegExpMatchArray,
  cardPlatformName: string | null,
): ExtractedArtistId | null {
  const [, urlType, spotifyId] = match;
  if (urlType?.toLowerCase() !== "artist") return null;
  if (!spotifyId || !/^[A-Za-z0-9]{22}$/.test(spotifyId)) return null;
  return { siteName: "spotify", cardPlatformName, id: spotifyId };
}
