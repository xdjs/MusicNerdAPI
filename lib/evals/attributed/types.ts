/** Server-issued descriptor captured with the parent read, not supplied by a selected answer. */
export type AllowedBlock = {
  kind?: "pdf-page-text";
  originalSha256?: string;
  physicalPage?: number;
  physicalPages?: number;
  pageSha256?: string;
  id: string;
  sourceId: string;
  revision: string;
  start: number;
  end: number;
  sha256: string;
  readId: string;
  readStart: number;
  readEnd: number;
  readSha256: string;
  context: string;
  contextIncomplete: boolean;
  coverage: "complete-read" | "partial-read";
};
/** Captured from server-resolved typed UI records, never reconstructed from prose. */
export type AttributedCapture = {
  state: "selecting" | "complete-transport" | "partial" | "failed" | "stopped" | "unavailable";
  pdfTextUnavailable: boolean;
  passages: (AllowedBlock & { n: number; url: string; text: string })[];
};
export type Evidence = {
  n: number;
  url: string;
  text: string;
  tool: "readSource" | "webSearch" | "readPdfSource" | "readNamedPdf";
  toolCallId: string;
  sha256: string;
  pages?: number[];
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
  allowedBlocks?: AllowedBlock[];
  publishedAt?: string | null;
  activityDate?: string | null;
  retrievedAt?: string | null;
};
export type ReadCapture = {
  toolCallId: string;
  tool: Evidence["tool"];
  complete: boolean;
  totalPages?: number;
  sourceId?: string;
  revision?: string;
  originalSha256?: string;
};
export type EvaluationInput = {
  question: string;
  reference: string;
  answerable: boolean;
  answer: string;
  error?: string;
  attributed?: AttributedCapture;
  sources: { n: number; url: string }[];
  evidence?: Evidence[];
  /** Produced by the capture adapter, never inferred from the answer's citations. */
  capture?: { complete: boolean; reads: ReadCapture[] };
};
export type PreparedEvaluation =
  | { status: "unscored"; reason: string; attributed?: AttributedCapture }
  | {
      status: "ready";
      instructions: string;
      payload: {
        question: string;
        reference: string;
        answerable: boolean;
        answer: string;
        evidence: Evidence[];
        outputMode: "ordinary-answer" | "attributed-passages";
        attributed?: AttributedCapture;
        citedSupport: { n: number; evidenceIndexes: number[] }[];
        inventoryEvidenceIndexes: number[];
        coverageScope: "captured reads only; not whole corpus";
      };
    };
/** Optional downstream semantic judge contract, not generated or validated by this offline preparer. */
export type SemanticAssessment = {
  citedSupport: { score: number; reason: string };
  requestedInventoryCoverage: { score: number; reason: string };
  counterevidenceHandling: { score: number; reason: string };
  uncertaintyHandling: { score: number; reason: string };
  responseUsability: { score: number; reason: string };
};
