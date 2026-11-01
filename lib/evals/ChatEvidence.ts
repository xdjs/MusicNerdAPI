/** Public evidence captured from the evaluated turn, never refetched by the judge. */
export type ChatEvidence = {
  n: number;
  url: string;
  text: string;
  tool: "readSource" | "webSearch";
  toolCallId: string;
  sha256: string;
  /** Exact readSource metadata; never inferred from text or URLs. */
  publishedAt?: string | null;
  activityDate?: string | null;
  retrievedAt?: string | null;
};
