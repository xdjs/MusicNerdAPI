/** Artist columns the Artist Data tab tracks. Spotify is left out: it's the
 *  denominator for platform ID coverage, so counting it here would double it. */
export const TRACKED_COLUMNS = [
  { column: "instagram", category: "social" },
  { column: "bluesky", category: "social" },
  { column: "x", category: "social" },
  { column: "facebook", category: "social" },
  { column: "tiktok", category: "social" },
  { column: "youtube", category: "social" },
  { column: "youtubechannel", category: "social" },
  { column: "soundcloud", category: "listen" },
  { column: "bandcamp", category: "listen" },
  { column: "subvert", category: "listen" },
  { column: "discogs", category: "reference" },
  { column: "lastfm", category: "reference" },
  { column: "musicbrainz", category: "reference" },
  { column: "wikidata", category: "reference" },
  { column: "imdb", category: "reference" },
  { column: "wikipedia", category: "reference" },
  { column: "bio", category: "content" },
  { column: "linkedin", category: "social" },
  { column: "farcaster", category: "social" },
  { column: "twitch", category: "social" },
  { column: "patreon", category: "social" },
] as const;

/** How long the Artist Data summary is reused; building it scans the whole artists table. */
export const ARTIST_DATA_CACHE_TTL_MS = 30_000;
