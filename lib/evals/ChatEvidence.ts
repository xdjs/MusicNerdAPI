/** Public evidence captured from the evaluated turn, never refetched by the judge. */
export type ChatEvidence = {
  n: number;
  url: string;
  text: string;
  tool: "readSource" | "webSearch" | "readPdfSource" | "readNamedPdf";
  toolCallId: string;
  sha256: string;
  kind?: "pdf-page-text";
  originalSha256?: string;
  physicalPage?: number;
  physicalPages?: number;
  pageSha256?: string;
  sourceId?: string;
  revision?: string;
  start?: number;
  end?: number;
  readId?: string;
  allowedBlocks?: import("./attributed/types").AllowedBlock[];
  /** Exact readSource metadata; never inferred from text or URLs. */
  publishedAt?: string | null;
  activityDate?: string | null;
  retrievedAt?: string | null;
};
