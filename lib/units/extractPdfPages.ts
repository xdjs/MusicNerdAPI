import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { MAX_INGEST_PAGES } from "@/lib/units/types";
import { renderPdfPageText } from "@/lib/units/renderPdfPageText";
import { PDF_PARSE_TIMEOUT_MS } from "@/lib/vaultUpload/const";

/**
 * The text of each physical page of a PDF, for the page-level unit index.
 *
 * @param bytes - The PDF's bytes (a plain Uint8Array, not a pooled Buffer).
 * @param opts - `timeoutMs` bounds the parse; `maxPages` caps how many pages are read; `signal`
 * rejects the call when it aborts (the parse itself cannot be cancelled and is left to finish unread).
 * @returns `pages[i]` is the trimmed text of page `i + 1`; `truncated` is true when
 * the document has more pages than `maxPages`.
 * @throws When the parse exceeds the timeout (message matches /timed out/i), the signal aborts
 * (an `AbortError`), or the parse fails.
 */
export async function extractPdfPages(
  bytes: Uint8Array,
  opts: { timeoutMs?: number; maxPages?: number; signal?: AbortSignal } = {},
): Promise<{ pages: string[]; truncated: boolean }> {
  const timeoutMs = opts.timeoutMs ?? PDF_PARSE_TIMEOUT_MS;
  const maxPages = opts.maxPages ?? MAX_INGEST_PAGES;
  const pages: string[] = [];
  const startedAt = Date.now();
  const timedOut = () => new Error("PDF parse timed out");
  const aborted = () => new DOMException("PDF parse aborted", "AbortError");
  if (opts.signal?.aborted) throw aborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const result = await Promise.race([
      pdfParse(bytes, {
        max: maxPages,
        pagerender: async (pageData: Parameters<typeof renderPdfPageText>[0]) => {
          const text = (await renderPdfPageText(pageData)).trim();
          // By physical page number: pdf-parse swallows a page's render error, so
          // pushing would shift every later page onto the wrong index.
          pages[(pageData.pageNumber ?? pages.length + 1) - 1] = text;
          return text;
        },
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(timedOut()), timeoutMs);
        onAbort = () => reject(aborted());
        opts.signal?.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
    // A small document can finish before the timer's macrotask runs; the budget still applies.
    if (Date.now() - startedAt >= timeoutMs) throw timedOut();
    const rendered = Math.min(result.numpages, maxPages);
    // Holes (pages that failed to render) become empty strings, keeping pages[i] = page i + 1.
    const filled = Array.from({ length: rendered }, (_, i) => pages[i] ?? "");
    return { pages: filled, truncated: result.numpages > maxPages };
  } finally {
    clearTimeout(timer);
    if (onAbort) opts.signal?.removeEventListener("abort", onAbort);
  }
}
