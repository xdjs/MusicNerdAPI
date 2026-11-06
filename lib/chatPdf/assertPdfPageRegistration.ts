import type { PdfPageOutput, ChatPdf, PdfPageManifest, PdfTextLocator } from "./types";
import { pdfTextHash } from "./pdfTextHash";
const splits = (text: string, offset: number) =>
  offset > 0 &&
  offset < text.length &&
  /[\uD800-\uDBFF]/.test(text[offset - 1]) &&
  /[\uDC00-\uDFFF]/.test(text[offset]);

export function assertPdfPageRegistration(
  pages: PdfPageOutput[],
  source: ChatPdf,
  manifest: PdfPageManifest,
  n: number,
  locator?: PdfTextLocator,
) {
  if (!Array.isArray(pages) || !pages.length || pages.length !== manifest.physicalPages)
    throw new Error("Invalid PDF page registration");
  const seen = new Set<number>();
  for (const [index, output] of pages.entries()) {
    const page = manifest.pages[output.physicalPage - 1];
    if (
      !page ||
      output.physicalPage !== index + 1 ||
      output.start !== 0 ||
      output.end !== page.text.length ||
      seen.has(output.physicalPage) ||
      output.sourceId !== source.id ||
      output.revision !== source.revision ||
      output.n !== n ||
      output.title !== source.title ||
      output.url !== source.url ||
      output.originalSha256 !== manifest.originalSha256 ||
      output.physicalPages !== manifest.physicalPages ||
      output.pageSha256 !== page.sha256 ||
      !Number.isSafeInteger(output.start) ||
      !Number.isSafeInteger(output.end) ||
      output.start < 0 ||
      output.end < output.start ||
      output.end > page.text.length ||
      splits(page.text, output.start) ||
      splits(page.text, output.end) ||
      output.text !== page.text.slice(output.start, output.end) ||
      output.sha256 !== pdfTextHash(output.text)
    )
      throw new Error("Unbound PDF page registration");
    seen.add(output.physicalPage);
    if (!page.text.trim()) {
      if (
        output.kind !== "pdf-page-unavailable" ||
        output.availability !== "no-extracted-text" ||
        !Array.isArray(output.blocks) ||
        output.blocks.length ||
        Object.hasOwn(output, "readId") ||
        locator?.physicalPage === page.physicalPage
      )
        throw new Error("Invalid unavailable PDF page registration");
      continue;
    }
    if (
      output.kind !== "pdf-page-text" ||
      typeof output.readId !== "string" ||
      !/^[a-f0-9]{64}$/.test(output.readId) ||
      !Array.isArray(output.blocks) ||
      (locator &&
        output.physicalPage === locator.physicalPage &&
        !output.blocks.some(
          block =>
            block.start === locator.start &&
            block.end === locator.end &&
            block.sha256 === locator.sha256 &&
            /^[a-f0-9]{64}$/.test(block.id),
        ))
    )
      throw new Error("Unbound PDF page registration");
  }
}
