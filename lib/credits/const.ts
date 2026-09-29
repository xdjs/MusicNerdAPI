import type { CaptionExtraction } from "@/lib/credits/types";

export const EMPTY_EXTRACTION: CaptionExtraction = { credits: [], statements: [] };

/**
 * Captions per model call. Forty timed out; fifteen made the model return
 * highlights instead of working through every caption. Recall matters more
 * than throughput in a background job.
 */
export const POSTS_PER_BATCH = 8;
/** Batches in flight at once. */
export const BATCH_CONCURRENCY = 3;
/**
 * Below this there is no sentence left once hashtags and dot-padding are
 * stripped. Deliberately low: "Shot by @moneaofthemoon" is 23 characters.
 */
export const MIN_CAPTION_CHARS = 12;
/** One model call's ceiling. The time goes into writing the answer, so feeds with many mentions need it. */
export const TIMEOUT_MS = 90_000;
/** Per batch, a backstop on a model that decides every sentence is a credit. */
export const MAX_CLAIMS_PER_BATCH = 60;
/** Less time than this left and a model call cannot usefully be started. */
export const MIN_CALL_BUDGET_MS = 8_000;
/** A role is a job, and a job is a few words. Longer is a sentence about a relationship. */
export const MAX_ROLE_WORDS = 6;
/** A role in the first person is the artist narrating, not crediting. */
export const FIRST_PERSON = /\b(i|me|my|myself|we|us|our|ours)\b/i;
/** First-person stand-ins an artist credits themselves with ("edited by moi"). */
export const SELF_WORDS = new Set([
  "moi",
  "me",
  "myself",
  "self",
  "yourstruly",
  "mua",
  "muah",
  "i",
]);
/** Roles that are only a grammatical hinge and say nothing about what anybody did. */
export const EMPTY_ROLES = new Set([
  "for",
  "with",
  "by",
  "to",
  "and",
  "at",
  "on",
  "in",
  "of",
  "from",
  "via",
  "ft",
  "the",
  "a",
]);
/** Below this, a finished read defers its sweep to the next slice. */
export const SWEEP_RESERVE_MS = 15_000;
