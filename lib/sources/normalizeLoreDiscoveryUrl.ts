import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

/**
 * Catalog artist keys use the parsed platform/ID, preserving opaque ID case.
 * Other URLs use host/path without www, trailing slashes or tracking. Opaque
 * catalog release IDs retain case. Apple Podcasts keeps its `i` parameter, which
 * identifies the episode rather than tracking. YouTube watch URLs retain their
 * case-sensitive video ID for the same reason.
 *
 * @param raw - A URL.
 * @returns The key.
 */
export function normalizeLoreDiscoveryUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const destination = parseMusicDestination(raw);
    if (destination?.kind === "artist")
      return `music:${destination.platform}:artist:${destination.id}`;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const youtubeHost = ["youtube.com", "m.youtube.com"].includes(host);
    const videoId =
      youtubeHost && url.pathname === "/watch"
        ? url.searchParams.get("v")
        : host === "youtu.be"
          ? url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
          : youtubeHost
            ? url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
            : null;
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) return `youtube.com/watch?v=${videoId}`;
    const rawPath = url.pathname.replace(/\/+$/, "");
    const path =
      destination && ["spotify", "qobuz", "amazon_music"].includes(destination.platform)
        ? rawPath
        : rawPath.toLowerCase();
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
