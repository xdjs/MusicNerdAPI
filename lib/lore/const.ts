/** Collaborators are capped tight: a bare "collaboration with @handle" says little on its own. */
export const MAX_COLLABORATOR_SOURCES = 4;
export const MAX_MUSIC_REF_SOURCES = 8;
/** A handful of self-credits covers the range without a credits roll. */
export const MAX_SELF_CREDIT_SOURCES = 6;
/** Their own words: the largest social allowance, and the only place the artist is a person rather than a discography. */
export const MAX_STATEMENT_SOURCES = 12;
/** How much of one source's text reaches the prompt. A handful of full sources is ~20k tokens of a ~1M context. */
export const SOURCE_TEXT_BUDGET = 12_000;
/** Catalog rows in the prompt: grounding for titles and dates, not a discography. */
export const CATALOG_LINES = 40;
/** The document's hard length cap. */
export const ARTIST_DOC_MAX_CHARS = 20_000;
/** The document call's bound. Measured p95 with thinking off is ~6.5 s. */
export const GEMINI_TIMEOUT_MS = 15_000;
/** The lighter summary call's bound. */
export const GEMINI_ABOUT_TIMEOUT_MS = 12_000;
/** A lore_refresh slice with less time than this waits for one that can finish the rebuild. */
export const DOC_REBUILD_RESERVE_MS = 20_000;
/** A Lore summary longer than this is discarded. */
export const LORE_SUMMARY_MAX_CHARS = 900;
/** The last-resort About's bound: a lighter prompt than the document or the cited About. */
export const FALLBACK_TIMEOUT_MS = 12_000;
