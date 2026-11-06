import type { PdfOutput } from "./createChatPdfTools";

/** Common identity remains at the root; exact page text and selectable offsets are never cropped. */
export function serializePdfModelMetadata(output: PdfOutput): string {
  return JSON.stringify(
    output.textPages
      ? {
          ...output,
          textPages: output.textPages.map(page => ({
            kind: page.kind,
            physicalPage: page.physicalPage,
            pageSha256: page.pageSha256,
            start: page.start,
            end: page.end,
            text: page.text,
            ...(page.kind === "pdf-page-unavailable" ? { availability: page.availability } : {}),
            blocks: page.blocks.map(({ id, start, end, contextIncomplete }) => ({
              id,
              start,
              end,
              contextIncomplete,
            })),
          })),
        }
      : output,
  );
}
