import { createHash } from "node:crypto";
import type { PdfEvalDocument } from "./pdfEvalTypes";
import { readPdfChatInventory } from "./readPdfChatInventory";
import { captureAllowedBlocks } from "./captureAllowedBlocks";
import { pdfTextLocatorSchema } from "@/lib/chatPdf/pdfTextLocatorSchema";

/** Reject unknown PDF fields before capture; never sanitize a bad result into a successful read. */
export function assertPdfEvalToolOutput(
  output: unknown,
  document: PdfEvalDocument | undefined,
  tool: "readPdfSource" | "readNamedPdf",
  toolCallId: string,
): void {
  const fail = (): never => {
    throw new Error("eval_pdf_identity");
  };
  const object = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : fail();
  const keys = (value: Record<string, unknown>, allowed: string[]) => {
    if (Object.keys(value).some(key => !allowed.includes(key))) fail();
  };
  const hex = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  const value = object(output);
  if ("error" in value) {
    keys(value, ["error", "textUnavailable"]);
    // These are the ordinary tool's fixed public errors, not arbitrary provider diagnostics.
    if (
      ![
        "PDF unavailable or read limit reached",
        "PDF unavailable",
        "PDF text locator is stale or unavailable",
        "PDF changed or unavailable",
        "Verified PDF text locator unavailable",
        "Could not read this PDF within the supported size, page or time limits. Do not guess its contents.",
        "Use only an exact PDF filename explicitly present in the latest question",
        "No unique eligible exact filename; use PDF discovery without guessing",
      ].includes(value.error as string) ||
      (value.textUnavailable !== undefined &&
        value.textUnavailable !== "verified_pdf_page_text_unavailable")
    )
      fail();
    return;
  }
  keys(value, [
    "sourceId",
    "n",
    "title",
    "pages",
    "sha256",
    "revision",
    "url",
    "textPages",
    "reopened",
    "textUnavailable",
  ]);
  if (!document) return fail();
  if (
    value.sourceId !== document.sourceId ||
    value.title !== document.filename ||
    value.sha256 !== document.sha256 ||
    value.pages !== document.pages ||
    !Number.isSafeInteger(value.n) ||
    (value.n as number) < 1 ||
    (value.revision !== undefined && value.revision !== document.revision) ||
    (value.url !== undefined && value.url !== document.url) ||
    (value.textUnavailable !== undefined &&
      value.textUnavailable !== "verified_pdf_page_text_unavailable") ||
    (value.textPages !== undefined && value.textUnavailable !== undefined)
  )
    fail();
  if (value.textPages !== undefined) {
    const inventory = readPdfChatInventory(tool, toolCallId, value);
    if (!inventory) fail();
    for (const item of value.textPages as unknown[]) {
      const page = object(item);
      keys(page, [
        "kind",
        "sourceId",
        "revision",
        "url",
        "text",
        "truncated",
        "originalSha256",
        "physicalPage",
        "physicalPages",
        "pageSha256",
        "n",
        "title",
        "start",
        "end",
        "readId",
        "sha256",
        "blocks",
        "limitation",
        "availability",
      ]);
      if (page.kind === "pdf-page-unavailable") {
        if (
          page.availability !== "no-extracted-text" ||
          Object.hasOwn(page, "readId") ||
          Object.hasOwn(page, "limitation") ||
          !Array.isArray(page.blocks) ||
          page.blocks.length ||
          (page.truncated !== undefined && typeof page.truncated !== "boolean")
        )
          fail();
        continue;
      }
      if (
        page.availability !== undefined ||
        page.title !== document.filename ||
        (page.truncated !== undefined && typeof page.truncated !== "boolean") ||
        !hex(page.readId) ||
        (page.limitation !== undefined &&
          (typeof page.limitation !== "string" ||
            !/^IDs identify exact bounded source excerpts, not relevance, completeness, or a resolved answer\. Surrounding context may be omitted\. Keep directly responsive contexts within (6000|12000) literal UTF-16 text characters total\. Up to 24 passages is only a resource guard; preserve relevant qualifications rather than dropping facts to satisfy a small block count\.$/.test(
              page.limitation,
            ))) ||
        !Array.isArray(page.blocks) ||
        page.blocks.length > 2048 ||
        captureAllowedBlocks(page.blocks).length !== page.blocks.length
      )
        fail();
      for (const item of page.blocks as unknown[]) {
        const block = object(item);
        keys(block, [
          "id",
          "kind",
          "originalSha256",
          "physicalPage",
          "physicalPages",
          "pageSha256",
          "sourceId",
          "revision",
          "sha256",
          "start",
          "end",
          "coverage",
          "context",
          "contextIncomplete",
          "readId",
          "readStart",
          "readEnd",
          "readSha256",
          "preview",
        ]);
        if (
          !hex(block.id) ||
          !hex(block.sha256) ||
          block.sourceId !== document.sourceId ||
          block.revision !== document.revision ||
          block.originalSha256 !== document.sha256 ||
          block.physicalPage !== page.physicalPage ||
          block.physicalPages !== page.physicalPages ||
          block.pageSha256 !== page.pageSha256 ||
          block.readId !== page.readId ||
          block.readSha256 !== page.sha256 ||
          block.readStart !== page.start ||
          block.readEnd !== page.end ||
          block.context !== "pdf-page-context-v1" ||
          block.kind !== "pdf-page-text" ||
          block.coverage !== "partial-read" ||
          block.contextIncomplete !== true ||
          !Number.isSafeInteger(block.start) ||
          !Number.isSafeInteger(block.end) ||
          (block.start as number) < 0 ||
          (block.end as number) <= (block.start as number) ||
          (block.end as number) > (page.end as number) ||
          (block.end as number) - (block.start as number) > 6000 ||
          (block.preview !== undefined &&
            (typeof block.preview !== "string" || block.preview.length > 160))
        )
          fail();
        const text = (page.text as string).slice(block.start as number, block.end as number);
        if (
          !text.isWellFormed() ||
          createHash("sha256").update(text).digest("hex") !== block.sha256 ||
          (block.preview !== undefined && block.preview !== text.slice(0, 160))
        )
          fail();
      }
    }
  }
  if (value.reopened !== undefined) {
    const reopened = object(value.reopened);
    keys(reopened, ["locator", "blockIds"]);
    const locator = object(reopened.locator);
    keys(locator, [
      "sourceId",
      "revision",
      "originalSha256",
      "physicalPage",
      "pageSha256",
      "start",
      "end",
      "sha256",
    ]);
    if (
      !pdfTextLocatorSchema.safeParse(locator).success ||
      locator.sourceId !== document.sourceId ||
      locator.revision !== document.revision ||
      locator.originalSha256 !== document.sha256 ||
      !Array.isArray(value.textPages) ||
      !Array.isArray(reopened.blockIds) ||
      reopened.blockIds.length < 1 ||
      reopened.blockIds.length > 24 ||
      !reopened.blockIds.every(hex)
    )
      fail();
    const page = (value.textPages as Record<string, unknown>[]).find(
      p => p.physicalPage === locator.physicalPage,
    );
    if (
      !page ||
      page.kind !== "pdf-page-text" ||
      locator.pageSha256 !== page.pageSha256 ||
      !(reopened.blockIds as string[]).every(id =>
        (page.blocks as Record<string, unknown>[]).some(
          block =>
            block.id === id &&
            block.start === locator.start &&
            block.end === locator.end &&
            block.sha256 === locator.sha256,
        ),
      )
    )
      fail();
  }
}
