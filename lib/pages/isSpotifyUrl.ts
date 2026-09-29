/**
 * Whether a URL is on open.spotify.com.
 *
 * @param url - Any URL.
 * @returns True for open.spotify.com; false otherwise or when unparseable.
 */
export function isSpotifyUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === "open.spotify.com";
  } catch {
    return false;
  }
}
