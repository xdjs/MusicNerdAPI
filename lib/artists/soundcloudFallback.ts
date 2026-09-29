import type { ExtractedArtistId, UrlMapRow } from "@/lib/artists/types";

/**
 * SoundCloud usernames the urlmap pattern missed (it requires https), read from
 * the first path segment. User-id and numeric segments can't make a profile URL.
 *
 * @param artistUrl - The URL as given.
 * @param allLinks - The urlmap rows.
 * @returns The reading, or null.
 */
export function soundcloudFallback(
  artistUrl: string,
  allLinks: UrlMapRow[],
): ExtractedArtistId | null {
  if (/soundcloud\.com\/user-\d+/i.test(artistUrl)) return null;
  const row = allLinks.find(l => l.siteName === "soundcloud");
  if (!row || !artistUrl.includes("soundcloud.com")) return null;
  try {
    const url = new URL(artistUrl.startsWith("http") ? artistUrl : `https://${artistUrl}`);
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (segment && !/^user-?\d+$/i.test(segment) && !/^\d+$/.test(segment)) {
      return { siteName: "soundcloud", cardPlatformName: row.cardPlatformName, id: segment };
    }
  } catch {
    // Not a URL.
  }
  return null;
}
