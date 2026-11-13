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

export type IngestOutcome = {
  units: number;
  ocrPages: number;
  embedded: boolean;
  skipped?: "not-found" | "no-text" | "too-large";
  failed?: "vision" | "extract";
};

export const UNIT_INGEST_VERSION = 1;
export const EMBEDDING_DIMENSIONS = 1536;
export const EMBED_BATCH = 64;
export const MAX_INGEST_PAGES = 300;
export const INLINE_INGEST_MAX_PAGES = 40;
export const MAX_UNIT_CHARS = 6000;
export const MAX_PAGE_CHARS = 24000;
export const SEARCH_CANDIDATES = 20;
export const SEARCH_LIMIT = 8;
export const MAX_UNITS_PER_DOCUMENT = 3;
export const RRF_K = 60;
export const PASSAGE_CHARS = 1200;
export const READ_UNITS_TOKEN_BUDGET = 12000;
export const WEAK_COSINE_DISTANCE = 0.6;
