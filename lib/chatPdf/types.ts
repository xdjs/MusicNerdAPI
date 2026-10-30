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
  claimId: string;
};
