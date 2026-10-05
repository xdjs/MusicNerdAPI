import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

/**
 * Catalog artist keys use the parsed platform/ID, preserving opaque ID case.
 * Other URLs use host/path without www, trailing slashes or tracking. Opaque
 * catalog release IDs retain case. Apple Podcasts keeps its `i` parameter, which
 * identifies the episode rather than tracking.
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
