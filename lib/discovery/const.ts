import type { ProfileDisplayColumn } from "@/lib/links/types";

/** Hard backstop checked between tiers. Raised 20 s → 35 s in MusicNerdWeb:
 *  runs were hitting it often enough that tier 4 was silently cut. Leaves ~20 s
 *  of the route's 55 s for the payload and the stream. */
export const DISCOVERY_BUDGET_MS = 35_000;

/** Platforms that reliably serve og:image for a real profile; a miss there is
 *  a sign a search-found URL may not exist. */
export const OG_RELIABLE_SITENAMES = new Set(["spotify", "instagram", "youtube"]);

/** The handle-based platforms with no search API. Spotify and Deezer always go
 *  through tier 2 instead. */
export const HANDLE_BASED_PLATFORM_DOMAINS: Partial<Record<ProfileDisplayColumn, string>> = {
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  x: "x.com",
  youtube: "youtube.com",
  soundcloud: "soundcloud.com",
  bandcamp: "bandcamp.com",
  twitch: "twitch.tv",
  facebook: "facebook.com",
};

/** `artist_id_mappings` platforms that are also profile-card columns. */
export const MAPPING_PLATFORM_TO_COLUMN: Partial<Record<string, ProfileDisplayColumn>> = {
  deezer: "deezer",
};

/** TikTok serves a server-side fetch no title and no image for any handle,
 *  so a probe can only produce false negatives. X was removed after
 *  re-measuring on 2026-08-21. */
export const PROBE_UNVERIFIABLE_PLATFORMS = new Set<ProfileDisplayColumn>(["tiktok"]);

/** Polite-client cap on simultaneous probe fetches. */
export const PROBE_CONCURRENCY = 8;

/** Cap on slugs derived from the artist's name. */
export const MAX_DERIVED_SLUGS = 4;

/** Candidates one platform may offer: a choice between two, not a list. */
export const MAX_CANDIDATES_PER_PLATFORM = 2;

/** Results per tier-4 search. */
export const WEB_SEARCH_MAX_RESULTS = 5;

/** Bandcamp's own subdomains, which its regex would read as an artist. */
export const BANDCAMP_RESERVED_SUBDOMAINS = new Set(["blog", "daily", "help", "support", "get"]);

/** Boilerplate platforms append to a profile's og:title, identical on every
 *  profile, so it can never count as evidence of the artist's name. */
export const TITLE_BOILERPLATE_FRAGMENTS: RegExp[] = [
  /[•·]\s*instagram photos and videos\s*$/i,
  /-\s*twitch\s*$/i,
  /\|\s*spotify\s*$/i,
  /\bon soundcloud\s*$/i,
  /-\s*youtube\s*$/i,
  /\|\s*facebook\s*$/i,
];
