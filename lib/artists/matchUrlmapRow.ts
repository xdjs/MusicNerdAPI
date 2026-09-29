import { genericArtistId } from "@/lib/artists/genericArtistId";
import { hostAllowedFor } from "@/lib/artists/hostAllowedFor";
import { matchFacebook } from "@/lib/artists/matchFacebook";
import { matchSpotify } from "@/lib/artists/matchSpotify";
import { matchYoutube } from "@/lib/artists/matchYoutube";
import { matchYoutubeChannel } from "@/lib/artists/matchYoutubeChannel";
import type { ExtractedArtistId, UrlMapRow } from "@/lib/artists/types";

/**
 * Tries one urlmap row on a URL. The platform readers run first; one that
 * reads nothing falls through to the first capture group.
 *
 * @param row - The urlmap row; its regex is stored as text.
 * @param url - The decoded URL.
 * @returns The reading; null when the row matched but rejects the URL; undefined when it did not match.
 */
export function matchUrlmapRow(row: UrlMapRow, url: string): ExtractedArtistId | null | undefined {
  const { siteName, cardPlatformName, regex } = row;
  if (!hostAllowedFor(siteName, url)) return undefined;
  let pattern: RegExp;
  try {
    pattern = new RegExp(regex, "i");
  } catch (err) {
    console.error("[extractArtistId] Invalid regex in urlmap row", siteName, ":", regex, err);
    return undefined;
  }
  const match = url.match(pattern);
  if (!match) return undefined;
  if (siteName === "spotify") return matchSpotify(match, cardPlatformName);
  const specific =
    siteName === "youtubechannel"
      ? matchYoutubeChannel(match, cardPlatformName)
      : siteName === "youtube"
        ? matchYoutube(match, cardPlatformName)
        : siteName === "facebook"
          ? matchFacebook(match, cardPlatformName)
          : undefined;
  return specific !== undefined ? specific : genericArtistId(siteName, match, cardPlatformName);
}
