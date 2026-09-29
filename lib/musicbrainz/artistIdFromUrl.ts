/**
 * The id after /artist/ in a platform URL, as a whole path segment. A substring
 * test would read deezer.com/artist/1234 as our 123 and promote a different
 * artist to an identifier match.
 *
 * @param url - A URL MusicBrainz relates to the entry.
 * @param host - The platform host it must be on, e.g. "spotify.com".
 * @returns The id, or null.
 */
export function artistIdFromUrl(url: string, host: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(host)) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const at = segments.indexOf("artist");
    return at >= 0 ? (segments[at + 1] ?? null) : null;
  } catch {
    return null;
  }
}
