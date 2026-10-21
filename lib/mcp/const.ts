/** The MCP server's identity, as `initialize` reports it. */
export const MCP_SERVER_INFO = { name: "Music Nerd", version: "1.0.0" } as const;

/** The platforms a cross-platform ID mapping may target. */
export const VALID_MAPPING_PLATFORMS = new Set([
  "deezer",
  "apple_music",
  "musicbrainz",
  "wikidata",
  "tidal",
  "amazon_music",
  "youtube_music",
  "genius",
  "allmusic",
  "billboard",
  "rolling_stone",
]);

/** How a mapping may have been determined. */
export const VALID_SOURCES = new Set([
  "wikidata",
  "musicbrainz",
  "name_search",
  "web_search",
  "manual",
]);

/** Why an artist is excluded from mapping; `z.enum` needs the readonly tuple, the set is for O(1) lookups. */
export const EXCLUSION_REASON_VALUES = ["conflict", "name_mismatch", "too_ambiguous"] as const;
export const VALID_EXCLUSION_REASONS = new Set<string>(EXCLUSION_REASON_VALUES);

/** Mapping confidence, highest first: a lower tier never overwrites a higher one. */
export const CONFIDENCE_PRIORITY: Record<string, number> = {
  manual: 4,
  high: 3,
  medium: 2,
  low: 1,
};
