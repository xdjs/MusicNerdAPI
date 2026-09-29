/**
 * Is a search result shaped like a profile page? `extractArtistId`'s regexes
 * take "the first path segment" as a handle, so `instagram.com/reel/<id>` or
 * `youtube.com/watch?v=` would otherwise yield a garbage handle. One path
 * segment, or none for Bandcamp's bare subdomain, and no query or fragment.
 *
 * @param rawUrl - The result URL.
 * @returns True when it can be a profile.
 */
export function looksLikeProfileUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.search || url.hash) return false;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length > 1) return false;
  if (segments.length === 0) return true;
  return segments[0].replace(/^@/, "").length > 0;
}
