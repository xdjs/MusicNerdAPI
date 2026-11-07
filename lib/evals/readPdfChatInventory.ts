import { createHash } from "node:crypto";
import type { ChatEvidence } from "./ChatEvidence";
import { captureAllowedBlocks } from "./captureAllowedBlocks";
/** Validate every physical position, retaining explicit unavailable statuses without treating them as evidence. */
export function readPdfChatInventory(
  tool: "readPdfSource" | "readNamedPdf",
  toolCallId: string,
  output: unknown,
): { evidence: ChatEvidence[]; unavailablePages: number[] } | undefined {
  if (!output || typeof output !== "object") return undefined;
  const root = output as Record<string, unknown>;
  if (
    typeof root.sourceId !== "string" ||
    !root.sourceId ||
    typeof root.revision !== "string" ||
    !root.revision ||
    !Number.isSafeInteger(root.n) ||
    (root.n as number) < 1 ||
    typeof root.url !== "string" ||
    !root.url ||
    typeof root.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(root.sha256) ||
    !Number.isSafeInteger(root.pages) ||
    (root.pages as number) < 1 ||
    (root.pages as number) > 50 ||
    !Array.isArray(root.textPages) ||
    root.textPages.length !== root.pages
  )
    return undefined;
  const rows: ChatEvidence[] = [];
  const unavailablePages: number[] = [];
  const readIds = new Set<string>();
  for (let i = 0; i < root.textPages.length; i++) {
    const page = root.textPages[i];
    if (
      !page ||
      typeof page !== "object" ||
      page.sourceId !== root.sourceId ||
      page.revision !== root.revision ||
      page.n !== root.n ||
      page.url !== root.url ||
      page.physicalPage !== i + 1 ||
      page.physicalPages !== root.pages ||
      page.originalSha256 !== root.sha256 ||
      typeof page.text !== "string" ||
      page.start !== 0 ||
      page.end !== page.text.length ||
      (typeof root.title === "string" && page.title !== root.title)
    )
      return undefined;
    const sha256 = createHash("sha256").update(page.text).digest("hex");
    if (page.sha256 !== sha256 || page.pageSha256 !== sha256) return undefined;
    if (page.kind === "pdf-page-unavailable") {
      if (
        page.text.trim() ||
        page.availability !== "no-extracted-text" ||
        !Array.isArray(page.blocks) ||
        page.blocks.length ||
        Object.hasOwn(page, "readId")
      )
        return undefined;
      unavailablePages.push(page.physicalPage);
      continue;
    }
    if (
      page.kind !== "pdf-page-text" ||
      !page.text.trim() ||
      typeof page.readId !== "string" ||
      !page.readId ||
      readIds.has(page.readId)
    )
      return undefined;
    readIds.add(page.readId);
    rows.push({
      n: page.n,
      url: page.url,
      text: page.text,
      tool,
      toolCallId,
      sha256,
      sourceId: page.sourceId,
      revision: page.revision,
      start: 0,
      end: page.end,
      readId: page.readId,
      kind: "pdf-page-text",
      originalSha256: page.originalSha256,
      physicalPage: page.physicalPage,
      physicalPages: page.physicalPages,
      pageSha256: page.pageSha256,
      allowedBlocks: captureAllowedBlocks(page.blocks),
    });
  }
  return { evidence: rows, unavailablePages };
}
