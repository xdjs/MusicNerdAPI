import { isMusicBrainzPlatformId } from "@/lib/musicbrainz/isMusicBrainzPlatformId";
import type { PlatformArtistUrlMatch } from "@/lib/musicbrainz/types";
import type { MusicPlatform } from "@/lib/musicPlatform/types";

/**
 * Reads a URL as the platform's artist page. Only the canonical shape counts
 * (`/artist/<id>`, plus Deezer's `/<lang>/artist/<id>`); any other shape on
 * the platform's host is invalid, so a lookup can fail closed on it.
 *
 * @param url - A URL MusicBrainz relates to an entry.
 * @param platform - The platform to read it as.
 * @returns valid with the id, unrelated for another host or page, or invalid.
 */
export function matchPlatformArtistUrl(
  url: string,
  platform: MusicPlatform,
): PlatformArtistUrlMatch {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const validHost =
      platform === "spotify"
        ? hostname === "open.spotify.com"
        : hostname === "deezer.com" || hostname === "www.deezer.com";
    if (!validHost) return { status: "unrelated" };
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.port !== "" ||
      parsed.username !== "" ||
      parsed.password !== ""
    )
      return { status: "invalid" };

    const segments = parsed.pathname.split("/").filter(Boolean);
    const artistSegment = segments.findIndex(segment => segment.toLowerCase() === "artist");
    if (artistSegment < 0) return { status: "unrelated" };
    const bare = artistSegment === 0 && segments.length === 2 && segments[0] === "artist";
    const localized =
      artistSegment === 1 &&
      segments.length === 3 &&
      /^[a-z]{2}$/.test(segments[0]) &&
      segments[1] === "artist";
    if (!(bare || (platform === "deezer" && localized))) return { status: "invalid" };
    const platformId = segments[artistSegment + 1]?.trim();
    return platformId && isMusicBrainzPlatformId(platform, platformId)
      ? { status: "valid", platformId }
      : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}
