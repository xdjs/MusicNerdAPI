import { PDFDocument } from "pdf-lib";

/**
 * Cuts one page out of an already parsed PDF (`loadPdfDocument`) into a new one-page PDF for the
 * vision model, without parsing the document again (`slicePdfPage` parses it per call).
 *
 * @param source - The parsed document.
 * @param pageIndex - The page to keep, 0-based.
 * @returns A new one-page PDF.
 * @throws When the index is out of range.
 */
export async function sliceLoadedPdfPage(
  source: PDFDocument,
  pageIndex: number,
): Promise<Uint8Array> {
  const count = source.getPageCount();
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= count)
    throw new Error(`Page index ${pageIndex} is out of range for a ${count}-page PDF`);
  const slice = await PDFDocument.create();
  const [page] = await slice.copyPages(source, [pageIndex]);
  slice.addPage(page);
  return await slice.save();
}
