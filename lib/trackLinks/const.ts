import type { TrackLink } from "@/lib/trackLinks/types";

/** A provider gets this long; the slower one must not add to the faster one. */
export const PROVIDER_TIMEOUT_MS = 4_000;
/** A completed search is kept this long. */
export const CACHE_TTL_MS = 60 * 60 * 1000;
/** The oldest entry goes when the cache is full. */
export const CACHE_MAX = 500;
/** Words that mark a title's bracketed segment as somebody's VERSION of the
 *  record rather than part of its name. */
export const VERSION_WORDS =
  /\b(mix|remix|rmx|edit|version|rework|flip|bootleg|dub|instrumental|remaster(ed)?|live|acoustic)\b/i;
/** Completed searches, per instance, as MusicNerdWeb kept them. */
export const trackLinksCache = new Map<string, { at: number; links: TrackLink[] }>();
