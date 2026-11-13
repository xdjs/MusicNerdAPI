import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { MAX_INGEST_PAGES } from "@/lib/units/types";
import { renderPdfPageText } from "@/lib/units/renderPdfPageText";
import { PDF_PARSE_TIMEOUT_MS } from "@/lib/vaultUpload/const";

/**
 * The text of each physical page of a PDF, for the page-level unit index.
 *
 * @param bytes - The PDF's bytes (a plain Uint8Array, not a pooled Buffer).
 * @param opts - `timeoutMs` bounds the parse; `maxPages` caps how many pages are read.
 * @returns `pages[i]` is the trimmed text of page `i + 1`; `truncated` is true when
 * the document has more pages than `maxPages`.
 * @throws When the parse exceeds the timeout (message matches /timed out/i) or fails.
 */
export async function extractPdfPages(
  bytes: Uint8Array,
  opts: { timeoutMs?: number; maxPages?: number } = {},
): Promise<{ pages: string[]; truncated: boolean }> {
  const timeoutMs = opts.timeoutMs ?? PDF_PARSE_TIMEOUT_MS;
  const maxPages = opts.maxPages ?? MAX_INGEST_PAGES;
  const pages: string[] = [];
  const startedAt = Date.now();
  const timedOut = () => new Error("PDF parse timed out");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      pdfParse(bytes, {
        max: maxPages,
        pagerender: async (pageData: Parameters<typeof renderPdfPageText>[0]) => {
          const text = (await renderPdfPageText(pageData)).trim();
          pages.push(text);
          return text;
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timedOut()), timeoutMs);
      }),
    ]);
    // A small document can finish before the timer's macrotask runs; the budget still applies.
    if (Date.now() - startedAt >= timeoutMs) throw timedOut();
    return { pages, truncated: result.numpages > maxPages };
  } finally {
    clearTimeout(timer);
  }
}
