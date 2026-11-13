import { PDFDocument } from "pdf-lib";

/**
 * Parses a PDF once with pdf-lib, so its pages can be cut out one at a time (`sliceLoadedPdfPage`).
 *
 * @param bytes - The whole PDF.
 * @param signal - Rejects the call when it aborts (the parse yields between objects, so an abort
 * mid-parse is seen promptly; the parse itself is left to finish unread).
 * @returns The parsed document.
 * @throws When the signal aborts (an `AbortError`) or the PDF cannot be parsed.
 */
export async function loadPdfDocument(
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<PDFDocument> {
  const aborted = () => new DOMException("PDF load aborted", "AbortError");
  if (signal?.aborted) throw aborted();
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      PDFDocument.load(bytes),
      new Promise<never>((_, reject) => {
        onAbort = () => reject(aborted());
        signal?.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
