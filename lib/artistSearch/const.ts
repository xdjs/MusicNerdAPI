import type { BatchSearchArtistResult, SearchArtistResult } from "@/lib/artistSearch/types";

/** The link columns a search result's `linkCount` counts, as MusicNerdWeb
 *  listed them. Only those the search selects can be set; the rest count 0. */
export const LINK_FIELDS = [
  "bandcamp",
  "youtube",
  "youtubechannel",
  "instagram",
  "x",
  "facebook",
  "tiktok",
  "soundcloud",
  "patreon",
  "twitter", // alias for x (legacy)
  "linktree",
  "spotifyusername",
  "bandsintown",
  "audius",
  "zora",
  "catalog",
  "opensea",
  "foundation",
  "mirror",
  "soundxyz",
  "twitch",
  "wikidata",
  "wikipedia",
  "subvert",
  "bluesky",
] as const;
/** How many Deezer artists a search asks for. */
export const EXTERNAL_SEARCH_LIMIT = 10;
/** A whole search gives up after this, before Vercel does. */
export const SEARCH_TIMEOUT_MS = 12_000;
/** Search results are kept this long, per instance. */
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
/** `POST /api/searchArtists` results by query and bookmark list. */
export const searchArtistsCache = new Map<
  string,
  { results: SearchArtistResult[]; timestamp: number }
>();
/** `POST /api/searchArtists/batch` results by name list. */
export const searchArtistsBatchCache = new Map<
  string,
  { results: (BatchSearchArtistResult | null)[]; timestamp: number }
>();
