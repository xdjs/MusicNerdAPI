/** The HTTPS Instagram post, reel or tv link as given, or null for anything else (MusicNerdWeb `artistLatest.instagramPostUrl` with its `latestExternalUrl` guard inlined). */
export function instagramPostUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return /^(www\.)?instagram\.com$/.test(url.hostname) &&
    /^\/(p|reel|tv)\/[^/]+\/?$/.test(url.pathname)
    ? url.href
    : null;
}
