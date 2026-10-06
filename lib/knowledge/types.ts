import type {
  artistDocCorrections,
  artistInterviewAnswers,
  artistResearchJobs,
  artistVaultSources,
} from "@/lib/db/schema";

export type SourceKind = "vault" | "social_caption" | "reel_transcript";
export type Operation = "brief" | "sources" | "search" | "read" | "history" | "research-status";
export type RawKnowledge = {
  artist: { id: string; name: string | null; bio: string | null };
  summary: unknown;
  vault: Pick<
    typeof artistVaultSources.$inferSelect,
    | "id"
    | "artistId"
    | "status"
    | "origin"
    | "type"
    | "filePath"
    | "url"
    | "title"
    | "snippet"
    | "extractedText"
    | "publishedAt"
    | "createdAt"
    | "updatedAt"
  >[];
  social: {
    id: string;
    artistId: string;
    platform: string;
    ownerUsername: string;
    isOwnPost: boolean;
    caption: string | null;
    url: string;
    postedAt: string | null;
    transcript: unknown;
    isRepost: unknown;
    isRetweet: unknown;
  }[];
  answers: (typeof artistInterviewAnswers.$inferSelect)[];
  corrections: (typeof artistDocCorrections.$inferSelect)[];
  jobs: (Pick<
    typeof artistResearchJobs.$inferSelect,
    "id" | "artistId" | "kind" | "status" | "cursor" | "total" | "updatedAt"
  > & { extractionOutcomes?: unknown })[];
};
export type KnowledgeSource = {
  sourceId: string;
  kind: SourceKind;
  title: string | null;
  titleTruncated: boolean;
  description: string | null;
  descriptionTruncated: boolean;
  url: string | null;
  revision: string;
  publishedAt: string | null;
  ingestedAt: string | null;
  uploadedAt: string | null;
  eventDate: null;
  originalSourceUrl: null;
  provenance: {
    origin: "vault_link" | "vault_upload" | "social_caption" | "provider_transcript";
    provider: string | null;
    method: string | null;
    speaker: "not_applicable" | "unverified" | "verified";
    publisher: string | null;
    speakerName: null;
    relationship: "unknown";
  };
  extraction: {
    readiness: "ready" | "unknown";
    storedChars: number;
    truncated: boolean | null;
    limitations: string[];
  };
};
export type Evidence = { metadata: KnowledgeSource; text: string };
export type Coverage = {
  eligibleSources: number;
  readableSources: number;
  searchedSources: number;
  complete: boolean;
  limitations: string[];
};
export type HistoryField = {
  field: "question" | "answer" | "claim" | "correction";
  text: string | null;
  start: number;
  end: number;
  totalChars: number;
  complete: boolean;
};
export type HistoryEntry = {
  entryId: string;
  revision: string;
  kind: "answer" | "correction";
  questionKey: string | null;
  answerState: "answered" | "skipped" | "offered" | null;
  sitting: number | null;
  offeredAt: string | null;
  answerUpdatedAt: string | null;
  source: string | null;
  correctionKind: string | null;
  fields: HistoryField[];
};
export type KnowledgeJob = {
  extractionOutcomes?: import("@/lib/sourceExtraction/types").ExtractionOutcome[];
  jobId: string;
  kind:
    | "social_ingest"
    | "caption_extract"
    | "lore_refresh"
    | "source_search"
    | "latest_refresh"
    | "source_extract";
  status: "pending" | "running" | "done" | "failed";
  cursor: number;
  total: number | null;
  updatedAt: string | null;
  errorCategory: string | null;
};
export type KnowledgeSnapshot = {
  artist: RawKnowledge["artist"];
  summary: string | null;
  sources: Evidence[];
  history: HistoryEntry[];
  latestAnswer: { entryId: string; revision: string } | null;
  jobs: KnowledgeJob[];
  coverage: Coverage;
};
export type Passage = {
  source: KnowledgeSource;
  revision: string;
  text: string;
  start: number;
  end: number;
  page: null;
  startSeconds: null;
  endSeconds: null;
};
export type Budget = { returnedChars: number; truncated: boolean; nextCursor: string | null };
export type KnowledgeResults = {
  brief: {
    status: "ok";
    artistId: string;
    name: string | null;
    bio: string | null;
    generatedLoreSummary: string | null;
    summaryIsEvidence: false;
    coverage: Coverage;
    historyRequired: true;
    returnedChars: number;
    truncated: boolean;
  };
  sources: { status: "ok"; sources: KnowledgeSource[]; coverage: Coverage; budget: Budget };
  search: {
    status: "ok";
    passages: Passage[];
    coverage: Coverage;
    returnedChars: number;
    truncated: boolean;
  };
  read: {
    status: "ok";
    passage: Passage;
    totalChars: number;
    nextStart: number | null;
    returnedChars: number;
    truncated: boolean;
  };
  history: {
    status: "ok";
    entries: HistoryEntry[];
    budget: Budget;
    constraintsComplete: false;
    memory: { boundaryState: "not_implemented"; latestAnswer: KnowledgeSnapshot["latestAnswer"] };
    correctionsComplete: boolean;
  };
  "research-status": { status: "ok"; jobs: KnowledgeJob[]; coverage: Coverage; budget: Budget };
};
export type KnowledgeQuery =
  | { operation: "brief" }
  | { operation: "sources"; limit: number; cursor?: string; kind?: SourceKind }
  | { operation: "search"; query: string; limit: number; maxChars: number; kind?: SourceKind }
  | { operation: "read"; sourceId: string; revision: string; start: number; maxChars: number }
  | {
      operation: "history";
      limit: number;
      maxChars: number;
      cursor?: string;
      kind: "all" | "answers" | "corrections";
      sitting?: number;
    }
  | { operation: "research-status"; limit: number; cursor?: string };
export const MAX_KNOWLEDGE_ROWS = 5000;
export const MAX_KNOWLEDGE_CHARS = 4_000_000;
export const MAX_KNOWLEDGE_BYTES = 128 * 1024;
export type KnowledgeToolConfig = {
  apiOrigin: string;
  artistId: string;
  getAccessToken: (signal: AbortSignal) => Promise<string | null>;
  enableResearch?: boolean;
  timeoutMs?: number;
};
