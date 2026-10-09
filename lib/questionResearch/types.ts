export type ResearchRequest = {
  topic: string;
  evidenceNeed: "reporting" | "release_date" | "credits" | "social_caption" | "spoken_content";
  freshness: "stored" | "recent";
  /** Newest-available overview; explicit date/platform constraints still apply. */
  retrieval?: "relevance" | "latest";
  targetUrl?: string;
  excludeSourceUrls?: string[];
  platform?: "instagram" | "tiktok" | "x" | "inprocess" | "spotify" | "deezer";
  fromDate?: string;
  toDate?: string;
};
export type ResearchArtist = {
  [key: string]: unknown;
  id?: string;
  name: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  x?: string | null;
};
export type ResearchStage =
  | "checking_saved"
  | "searching"
  | "reading"
  | "transcribing"
  | "waiting_provider"
  | "complete"
  | "unresolved"
  | "failed"
  | "cancelled";
export type ResearchPlan =
  | { provider: null; stage: "unresolved"; reason: string }
  | { provider: "web"; stage: "searching"; query: string; reason: string }
  | { provider: "page"; stage: "reading"; targetUrl: string; reason: string }
  | {
      provider: "instagram" | "instagram_reels" | "tiktok" | "x";
      stage: "reading" | "transcribing";
      handle: string;
      targetUrl?: string;
      limit: number;
      reason: string;
    };
export type ResearchReference = {
  /** Provider activity date with original precision; not a source publication date. */
  activityDate?: string;
  activityDateKind?: "release" | "moment";
  sourceId: string;
  revision: string;
  start: number;
  end: number;
  text: string;
  url: string;
  curation: "approved" | "pending";
  evidenceKind: "original_text" | "caption" | "provider_transcript";
  speaker: "not_applicable" | "unverified";
  publishedAt: string | null;
  retrievedAt: string | null;
  truncated: boolean | null;
};
export type DiscoveryOriginal = {
  url: string;
  title: string | null;
  text: string;
  identity: "confirmed" | "unresolved";
  destination: "lore" | "link";
  platform?: string;
  platformId?: string;
  provenance: {
    kind: ResearchReference["evidenceKind"];
    provider: string;
    speaker: ResearchReference["speaker"];
    publisher: string | null;
    publishedAt: string | null;
    retrievedAt: string;
    truncated: boolean;
    runId?: string;
    limitations: string[];
  };
};
export type QuestionResearchState = {
  version: 1;
  /** Server-admitted saved-evidence lane; never allowed to collect externally. */
  savedOnly?: boolean;
  request: ResearchRequest;
  key: string;
  expectedClaimId: string | null;
  stage: ResearchStage;
  plan?: ResearchPlan;
  createdAt: string;
  /** Neutral request only; never visitor chat or private interview context. */
  references: ResearchReference[];
  limitations: string[];
  candidates?: { url: string; title: string }[];
  nextCandidate?: number;
  originals?: DiscoveryOriginal[];
  externalRequested?: boolean;
  runId?: string;
  datasetId?: string;
  nextPollAt?: string;
  modelCalls: number;
  outputRetries?: number;
  providerCalls: number;
  inputTokens: number;
  outputTokens: number;
  errorCode?: string;
  /** Server-only diagnostic; never stores the error message or request/source content. */
  failure?: {
    step: string;
    name: string;
    status: number | null;
    finishReason?: string;
    causeName?: string;
  };
  step?:
    "saved" | "search" | "pages" | "social_start" | "social_poll" | "social_collect" | "assess";
  inFlight?: "model" | "web" | "social_start";
};
export type ResearchAuth = { kind: "service" } | { kind: "artist"; userId: string };
export const QUESTION_RESEARCH_LIFETIME_MS = 15 * 60_000;
export const QUESTION_RESEARCH_DAILY_ARTIST = 5;
export const QUESTION_RESEARCH_DAILY_GLOBAL = 100;
export const SAVED_EVIDENCE_DAILY_ARTIST = 5;
export const SAVED_EVIDENCE_DAILY_GLOBAL = 100;
export const QUESTION_RESEARCH_CACHE_MS = 30 * 60_000;
export type ResearchOriginal = Omit<ResearchReference, "start" | "end">;
export type ResearchCandidateRow = {
  id: string;
  artist_id: string;
  url: string;
  destination: "lore" | "link";
  platform: string | null;
  platform_id: string | null;
  reason: string;
  identity: "confirmed" | "unresolved" | "wrong_artist";
  curation: "pending" | "approved" | "declined" | "wrong_artist" | "incorrect";
  source_id: string | null;
  reviewed_revision: string | null;
  current_revision?: string | null;
};
export type ResearchEvidenceRow = {
  id: string;
  revision: string;
  title: string | null;
  original_text: string;
  provenance: DiscoveryOriginal["provenance"];
};
