const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Whether a client may register a redirect URI: HTTPS anywhere, HTTP only on
 * `localhost` or `127.0.0.1`, and never with a fragment.
 *
 * @param uri - The redirect URI.
 * @returns True when it is allowed.
 */
export function isAllowedRedirectUri(uri: string): boolean {
  if (uri.includes("#")) return false;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}
