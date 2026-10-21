import { isMainWebsiteSource } from "@/lib/links/isMainWebsiteSource";
import type { DestinationSource } from "@/lib/links/types";
import { isMusicSource } from "@/lib/musicLinks/isMusicSource";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

/**
 * Whether a source is shown as a profile destination (Links or Support):
 * an artist catalog profile, or the artist's main website. Releases and
 * podcast episodes stay Lore sources.
 *
 * @param source - The source.
 * @param sources - The artist's other sources, to tell a main site from its pages.
 * @returns True for a destination.
 */
export function isDestinationSource(
  source: DestinationSource,
  sources: DestinationSource[] = [],
): boolean {
  if (source.podcastEpisodeKey) return false;
  const destination = parseMusicDestination(source.url);
  return destination
    ? destination.kind === "artist" && isMusicSource(source)
    : isMainWebsiteSource(source, sources);
}
