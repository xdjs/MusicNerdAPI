export type AttributionFamily = "first-earliest" | "alias-inventory";
export type PdfIdentity = {
  kind?: "pdf-page-text";
  originalSha256?: string;
  physicalPage?: number;
  physicalPages?: number;
  pageSha256?: string;
};
export type ReadOriginal = PdfIdentity & {
  sourceId: string;
  revision: string;
  text: string;
  url: string;
  truncated?: boolean | null;
};
export type ReadResult = {
  n: number;
  title: string;
  url: string;
  text: string;
  start?: number;
  end?: number;
  reopen?: { start: number; end: number; sha256: string };
};
export type Passage = PdfIdentity & {
  id: string;
  sourceId: string;
  revision: string;
  sha256: string;
  n: number;
  title: string;
  url: string;
  text: string;
  start: number;
  end: number;
  coverage: "complete-read" | "partial-read";
  context: "bounded-read-context-v1" | "pdf-page-context-v1";
  contextIncomplete: boolean;
  readId: string;
  readStart: number;
  readEnd: number;
  readSha256: string;
};
export type AttributionState =
  "selecting" | "complete-transport" | "partial" | "failed" | "stopped" | "unavailable";
