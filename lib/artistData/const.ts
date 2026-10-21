/**
 * The artist columns the Artist data tab tracks, with the category each is
 * shown under. Spotify is excluded: it is the denominator in Platform ID
 * coverage and in `totalWithSpotify`, and including it would double-count.
 */
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

/** How long one server instance reuses an Artist data summary. */
export const ARTIST_DATA_CACHE_TTL_MS = 30_000;
