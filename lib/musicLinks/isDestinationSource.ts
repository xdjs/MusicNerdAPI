import { isMainWebsiteSource } from "@/lib/musicLinks/isMainWebsiteSource";
import { isMusicSource } from "@/lib/musicLinks/isMusicSource";
import { parseMusicDestination } from "@/lib/musicLinks/parseMusicDestination";

type DestinationSource = {
  url: string;
  type?: string | null;
  status?: string;
  podcastEpisodeKey?: string | null;
};

/**
 * Does this source belong in the profile's Links/Support? Artist destinations
 * do; individual releases stay Lore sources.
 *
 * @param source - The source.
 * @param sources - The artist's other sources, for the main-website check.
 * @returns True for an artist music destination or the artist's main website.
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
