/** Public evidence captured from the evaluated turn, never refetched by the judge. */
export type ChatEvidence = {
  n: number;
  url: string;
  text: string;
  tool: "readSource" | "webSearch" | "readWebSource";
  toolCallId: string;
  sha256: string;
  /** Exact tool metadata, not inferred from passage text or the source URL. */
  publishedAt?: string | null;
  activityDate?: string | null;
  retrievedAt?: string | null;
  sourceId?: string;
  requestedUrl?: string;
  truncated?: boolean;
};
