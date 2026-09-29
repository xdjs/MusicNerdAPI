import type { JobKind } from "@/lib/research/types";

/**
 * The job kinds this API runs. MusicNerdWeb still runs the rest from the same
 * queue until they are ported (xdjs/MusicNerdWeb#1365); the lease keeps the
 * two workers off each other's jobs.
 */
export const PORTED_JOB_KINDS: JobKind[] = ["social_ingest"];

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
