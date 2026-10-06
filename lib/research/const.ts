import type { JobKind } from "@/lib/research/types";

/**
 * The job kinds this API runs: every research kind, since API 1d added
 * Update Latest's Instagram check. Until the web cutover both workers take
 * from the same queue, and the lease keeps them off each other's jobs
 * (xdjs/MusicNerdWeb#1365).
 */
export const PORTED_JOB_KINDS: JobKind[] = [
  "social_ingest",
  "caption_extract",
  "lore_refresh",
  "source_search",
  "latest_refresh",
  "source_extract",
];
/** A source search has no cursor, so a slice shorter than this cannot finish one. */
export const SOURCE_SEARCH_MIN_SLICE_MS = 30_000;

/** How long a claim is good for. A killed invocation's job is claimable again after this. */
export const LEASE_MS = 3 * 60 * 1000;
/** Failed attempts before a job is marked failed. The row stays, with last_error. */
export const MAX_ATTEMPTS = 4;
/** The route's whole allowance. 60 s is the ceiling on the current Vercel plan. */
export const ADVANCE_MAX_DURATION_S = 60;
/** Held back so the response is sent rather than the platform cutting us off mid-write. */
export const RESPONSE_RESERVE_MS = 4_000;
/** Held back inside a slice so it can persist what it did. */
export const PERSIST_RESERVE_MS = 5_000;
/** Below this, a scheduler tick has no room for a model call and the write after it. */
export const MIN_SLICE_MS = 12_000;
/** Thumbnail collection needs its own download budget, not the tail of a tick. */
export const COLLECTION_RESERVE_MS = 45_000;
/** "Look again" holds a new scrape this long after the last social job finished:
 *  long enough that the button can't be leaned on, short enough that a new post lands. */
export const RESEARCH_REFRESH_COOLDOWN_MS = 30 * 60 * 1000;
