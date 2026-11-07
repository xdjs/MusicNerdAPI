import type { PdfTextLocator, ChatPdf, PdfPageManifest } from "./types";
import { pdfTextHash } from "./pdfTextHash";
import { pdfTextLocatorSchema } from "./pdfTextLocatorSchema";
const splits = (text: string, offset: number) =>
  offset > 0 &&
  offset < text.length &&
  /[\uD800-\uDBFF]/.test(text[offset - 1]) &&
  /[\uDC00-\uDFFF]/.test(text[offset]);

export function assertPdfTextLocator(
  locator: PdfTextLocator,
  source: ChatPdf,
  manifest: PdfPageManifest,
) {
  if (!pdfTextLocatorSchema.safeParse(locator).success) throw new Error("Invalid PDF text locator");
  const page = manifest.pages[locator.physicalPage - 1];
  if (
    locator.sourceId !== source.id ||
    locator.revision !== source.revision ||
    locator.originalSha256 !== manifest.originalSha256 ||
    !page ||
    !page.text.trim() ||
    locator.pageSha256 !== page.sha256 ||
    locator.end <= locator.start ||
    locator.end > page.text.length ||
    locator.end - locator.start > 6000 ||
    splits(page.text, locator.start) ||
    splits(page.text, locator.end) ||
    pdfTextHash(page.text.slice(locator.start, locator.end)) !== locator.sha256
  )
    throw new Error("Stale or invalid PDF text locator");
}
