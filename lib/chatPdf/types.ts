export const MAX_CHAT_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_CHAT_PDF_PAGES = 50;
export const CHAT_PDF_READ_MS = 3000;
export type ChatPdf = {
  id: string;
  title: string;
  url: string;
  path: string;
  size: number;
  revision: string;
  claimId: string | null;
};

/** Original bytes and the deterministic physical-page text layer, never prior chat text. */
export type PdfPageManifest = Awaited<
  ReturnType<typeof import("./extractOriginalPdfPages").extractOriginalPdfPages>
>;
export type PdfTextLocator = {
  sourceId: string;
  revision: string;
  originalSha256: string;
  physicalPage: number;
  pageSha256: string;
  start: number;
  end: number;
  sha256: string;
};
export type PdfTextBlock = {
  [key: string]: unknown;
  id: string;
  start: number;
  end: number;
  preview?: string;
  contextIncomplete: boolean;
};
type PdfPageIdentityOutput = {
  [key: string]: unknown;
  sourceId: string;
  revision: string;
  n: number;
  title: string;
  url: string;
  text: string;
  start: number;
  end: number;
  sha256: string;
  originalSha256: string;
  physicalPage: number;
  physicalPages: number;
  pageSha256: string;
};
export type PdfTextPageOutput = PdfPageIdentityOutput & {
  kind: "pdf-page-text";
  readId: string;
  blocks: PdfTextBlock[];
};
/** A verified physical position with no selectable text; never an assertion of visual blankness. */
export type PdfUnavailablePageOutput = PdfPageIdentityOutput & {
  kind: "pdf-page-unavailable";
  availability: "no-extracted-text";
  blocks: [];
};
export type PdfPageOutput = PdfTextPageOutput | PdfUnavailablePageOutput;
export type PdfRegisteredSelection = {
  sourceId: string;
  revision: string;
  originalSha256: string;
  physicalPage: number;
  physicalPages: number;
  pageSha256: string;
};
export type PdfTextHooks = {
  onVerifiedTextRead: (
    source: ChatPdf,
    manifest: PdfPageManifest & { locator?: PdfTextLocator },
    citation: number,
  ) => { textPages: PdfPageOutput[] } | Promise<{ textPages: PdfPageOutput[] }>;
  onTextUnavailable: () => void;
};
