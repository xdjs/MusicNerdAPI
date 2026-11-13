import { PDFDocument } from "pdf-lib";

/**
 * Cuts one page out of a PDF so a single page can be sent to the vision model.
 *
 * @param bytes - The whole PDF.
 * @param pageIndex - The page to keep, 0-based.
 * @returns A new one-page PDF.
 */
export async function slicePdfPage(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes);
  const count = source.getPageCount();
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= count)
    throw new Error(`Page index ${pageIndex} is out of range for a ${count}-page PDF`);
  const slice = await PDFDocument.create();
  const [page] = await slice.copyPages(source, [pageIndex]);
  slice.addPage(page);
  return await slice.save();
}
