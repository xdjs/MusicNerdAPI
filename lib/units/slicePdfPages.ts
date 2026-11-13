import { PDFDocument } from "pdf-lib";

/**
 * Cuts several pages out of a PDF, each into its own one-page PDF for the vision model, parsing the
 * document once (`slicePdfPage` parses it per call).
 *
 * @param bytes - The whole PDF.
 * @param indexes - The pages to cut, 0-based.
 * @returns One new one-page PDF per index, in the order of `indexes`.
 * @throws When the PDF cannot be parsed or an index is out of range.
 */
export async function slicePdfPages(bytes: Uint8Array, indexes: number[]): Promise<Uint8Array[]> {
  if (indexes.length === 0) return [];
  const source = await PDFDocument.load(bytes);
  const count = source.getPageCount();
  for (const pageIndex of indexes)
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= count)
      throw new Error(`Page index ${pageIndex} is out of range for a ${count}-page PDF`);
  const slices: Uint8Array[] = [];
  for (const pageIndex of indexes) {
    const slice = await PDFDocument.create();
    const [page] = await slice.copyPages(source, [pageIndex]);
    slice.addPage(page);
    slices.push(await slice.save());
  }
  return slices;
}
