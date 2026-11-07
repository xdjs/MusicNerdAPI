import { createHash } from "node:crypto";
import type { createAttributionRegistry } from "./createAttributionRegistry";
import type { ChatPdf, PdfPageManifest, PdfTextLocator, PdfPageOutput } from "../chatPdf/types";

/** Register the complete verified physical-page inventory; locators add navigation, never narrow capture. */
export function registerPdfPages(
  registry: ReturnType<typeof createAttributionRegistry>,
  source: ChatPdf,
  manifest: PdfPageManifest & { locator?: PdfTextLocator },
  citation: number,
): { textPages: PdfPageOutput[] } {
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (
    !/^[a-f0-9]{64}$/.test(manifest.originalSha256) ||
    !Number.isSafeInteger(manifest.physicalPages) ||
    manifest.physicalPages < 1 ||
    manifest.physicalPages > 50 ||
    manifest.pages.length !== manifest.physicalPages ||
    manifest.pages.some(
      (p, i) =>
        p.physicalPage !== i + 1 ||
        typeof p.text !== "string" ||
        !p.text.isWellFormed() ||
        p.sha256 !== hash(p.text),
    )
  )
    throw new Error("Incomplete original-bound PDF page inventory");
  const textPages = manifest.pages.map((page): PdfPageOutput => {
    const original = {
      kind: "pdf-page-text" as const,
      sourceId: source.id,
      revision: source.revision,
      url: source.url,
      text: page.text,
      truncated: true,
      originalSha256: manifest.originalSha256,
      physicalPage: page.physicalPage,
      physicalPages: manifest.physicalPages,
      pageSha256: page.sha256,
    };
    if (!page.text.trim()) {
      registry.notePdfUnavailable();
      return {
        ...original,
        kind: "pdf-page-unavailable",
        availability: "no-extracted-text",
        n: citation,
        title: source.title,
        start: 0,
        end: page.text.length,
        sha256: page.sha256,
        blocks: [],
      };
    }
    const read = {
      n: citation,
      title: source.title,
      url: source.url,
      text: page.text,
      start: 0,
      end: page.text.length,
      ...(manifest.locator?.physicalPage === page.physicalPage
        ? {
            reopen: {
              start: manifest.locator.start,
              end: manifest.locator.end,
              sha256: manifest.locator.sha256,
            },
          }
        : {}),
    };
    const registered = registry.registerTextRead(original, read);
    return {
      ...original,
      n: citation,
      title: source.title,
      ...registered,
    };
  });
  return { textPages };
}
