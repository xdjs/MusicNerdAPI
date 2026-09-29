/**
 * The dedup key for a discovered URL: host without www, lowercase path without
 * trailing slashes, no query. Apple Podcasts keeps its `i` parameter, which
 * identifies the episode rather than tracking.
 *
 * @param raw - A URL.
 * @returns The key.
 */
export function normalizeLoreDiscoveryUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "").toLowerCase();
    const episodeId = host === "podcasts.apple.com" ? url.searchParams.get("i") : null;
    return `${host}${path}${episodeId ? `?i=${episodeId}` : ""}`;
  } catch {
    return raw
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/+$/, "");
  }
}
