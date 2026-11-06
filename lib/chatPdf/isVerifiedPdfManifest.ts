import { MAX_CHAT_PDF_PAGES, type PdfPageManifest } from "./types";
import { pdfTextHash } from "./pdfTextHash";
export function isVerifiedPdfManifest(
  manifest: PdfPageManifest | undefined,
  bytes: Uint8Array,
  hash: string,
  pages: number,
): manifest is PdfPageManifest {
  if (
    !manifest ||
    hash !== pdfTextHash(bytes) ||
    manifest.originalSha256 !== hash ||
    manifest.physicalPages !== pages ||
    pages < 1 ||
    pages > MAX_CHAT_PDF_PAGES ||
    !Number.isSafeInteger(pages) ||
    !Array.isArray(manifest.pages) ||
    manifest.pages.length !== pages ||
    manifest.extractor !== "pdf-parse@1.1.4/pdfjs@1.10.100/pdf-text-items-y-lines-v1" ||
    manifest.extraction?.coverage !== "all-physical-pages-text-layer" ||
    manifest.extraction.visualTextCompleteness !== "unverified" ||
    !Array.isArray(manifest.extraction.emptyTextPages)
  )
    return false;
  let total = 0;
  const validPages = manifest.pages.every((page, index) => {
    if (
      page.physicalPage !== index + 1 ||
      typeof page.text !== "string" ||
      !page.text.isWellFormed() ||
      page.text.length > 24000 ||
      page.sha256 !== pdfTextHash(page.text)
    )
      return false;
    total += page.text.length;
    return total <= 120000;
  });
  return (
    validPages &&
    JSON.stringify(manifest.extraction.emptyTextPages) ===
      JSON.stringify(
        manifest.pages.filter(page => !page.text.trim()).map(page => page.physicalPage),
      )
  );
}
