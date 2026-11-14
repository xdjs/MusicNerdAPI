export type UnitSourceKind = "vault" | "social" | "evidence";

export type UnitBody =
  | { kind: "pdf"; bytes: Uint8Array }
  | { kind: "markdown" | "plain"; text: string }
  | { kind: "none" };

export type UnitSourceInput = {
  sourceKind: UnitSourceKind;
  sourceId: string;
  artistId: string;
  title: string | null;
  url: string | null;
  sourceRevision: string;
  extractedTextIsNull: boolean;
  body: UnitBody;
};

export type UnitDraft = {
  unitIndex: number;
  locator: string;
  text: string;
  textHash: string;
  tokens: number;
  ocr: boolean;
};

export type UnitHit = {
  sourceKind: UnitSourceKind;
  sourceId: string;
  sourceRevision: string;
  unitIndex: number;
  locator: string;
  title: string | null;
  url: string | null;
  text: string;
  score: number;
};

/** One row of `listArtistUnitSources`: a source next to what the text index holds for it. */
export type UnitSyncEntry = {
  sourceKind: UnitSourceKind;
  sourceId: string;
  /** The source's current revision; null for an orphan, whose units must go. */
  sourceRevision: string | null;
  /** The revision the source's units carry, when they all carry one from the current ingest version; null when unindexed, mixed or older. */
  indexedRevision: string | null;
  /** Some unit of the source has no embedding. */
  needsEmbedding: boolean;
};

export type IngestOutcome = {
  units: number;
  ocrPages: number;
  embedded: boolean;
  skipped?: "not-found" | "no-text" | "too-large" | "needs-ocr" | "aborted";
  failed?: "vision" | "extract";
};

export const UNIT_INGEST_VERSION = 1;
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBED_BATCH = 16;
// The most characters sent in one embedding request.
export const EMBED_BATCH_CHARS = 100_000;
// The most characters of one unit sent for embedding; the stored unit text is not changed.
export const EMBED_INPUT_CHARS = 16_000;
export const MAX_INGEST_PAGES = 300;
export const INLINE_INGEST_MAX_PAGES = 40;
export const MAX_UNIT_CHARS = 6000;
// The most pages of one document sent to the vision model.
export const MAX_OCR_PAGES = 60;
// Vision reads of one document in flight at once.
export const OCR_CONCURRENCY = 4;
export const MAX_PAGE_CHARS = 24000;
// A unit_sync slice starts no source with less than this left before its deadline.
export const MIN_SOURCE_START_MS = 20_000;
// A unit_sync slice starts no source after this long, so a backfill does not hold every tick.
export const UNIT_SYNC_SLICE_MS = 20_000;
export const SEARCH_CANDIDATES = 20;
export const SEARCH_LIMIT = 8;
export const MAX_UNITS_PER_DOCUMENT = 3;
export const RRF_K = 60;
// Staging 2026-11-14: text-section units average 3,963 chars (32 of 41 over 2,400, longest 5,994) and
// 17 of 72 PDF pages exceed 2,400; at 2,400 one eval question's answering sentence (char 2,890 of
// 5,957) never reached the model. A search result is now the whole unit (at most MAX_UNIT_CHARS);
// only a denser PDF page is windowed.
export const PASSAGE_CHARS = MAX_UNIT_CHARS;
// Staging 2026-11-14: whole units make an 8-result search cost up to ~12,000 tokens, and an "every
// item" answer then reads a 13-unit document (~6,500 tokens) on top.
export const READ_UNITS_TOKEN_BUDGET = 24000;
export const WEAK_COSINE_DISTANCE = 0.6;
// Staging 2026-11-14: answers that read the whole 13-unit timeline PDF held 7 of 7 and 6 of 7
// required items, answers from three of its pages 5 of 7 and 2 of 3, and the model chose the whole
// read in about half of the runs. A search with several hits in a document this short returns it
// whole instead of leaving the read to the model.
export const SHORT_DOCUMENT_UNITS = 15;
// The most characters of not-yet-shown units a search adds when it returns a short document whole.
export const SHORT_DOCUMENT_CHARS = 32_000;

/**
 * Postgres's `english` stopword list (the Snowball list in `tsearch_data/english.stop`). A query
 * made only of these words gives an empty `websearch_to_tsquery('english', …)`, so
 * `searchUnitsByText` answers it with `[]` without a round trip; `trimToPassage` skips them when
 * it scores windows. The list must never hold a word Postgres keeps, or a real query would be
 * dropped; a word missing from it only costs a query that the SQL guard then empties.
 */
export const ENGLISH_STOPWORDS = new Set(
  (
    "i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she her hers herself " +
    "it its itself they them their theirs themselves what which who whom this that these those am is are was were be " +
    "been being have has had having do does did doing a an the and but if or because as until while of at by for with " +
    "about against between into through during before after above below to from up down in out on off over under " +
    "again further then once here there when where why how all any both each few more most other some such no nor " +
    "not only own same so than too very s t can will just don should now"
  ).split(" "),
);
