import type { AllowedBlock } from "./attributed/types";
/** Copy only explicit bound descriptor fields; previews never become evidence. */
export function captureAllowedBlocks(value: unknown): AllowedBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      b =>
        b &&
        typeof b === "object" &&
        ["id", "sourceId", "revision", "sha256", "readId", "readSha256", "context"].every(
          k => typeof b[k] === "string" && b[k],
        ) &&
        ["start", "end", "readStart", "readEnd"].every(k => Number.isSafeInteger(b[k])) &&
        typeof b.contextIncomplete === "boolean" &&
        ["complete-read", "partial-read"].includes(b.coverage) &&
        (b.kind === undefined ||
          (b.kind === "pdf-page-text" &&
            ["originalSha256", "pageSha256"].every(
              k => typeof b[k] === "string" && /^[a-f0-9]{64}$/.test(b[k]),
            ) &&
            Number.isSafeInteger(b.physicalPage) &&
            b.physicalPage > 0 &&
            Number.isSafeInteger(b.physicalPages) &&
            b.physicalPages >= b.physicalPage)),
    )
    .map(b => ({
      id: b.id,
      sourceId: b.sourceId,
      revision: b.revision,
      start: b.start,
      end: b.end,
      sha256: b.sha256,
      readId: b.readId,
      readStart: b.readStart,
      readEnd: b.readEnd,
      readSha256: b.readSha256,
      context: b.context,
      coverage: b.coverage,
      contextIncomplete: b.contextIncomplete,
      ...(b.kind === "pdf-page-text"
        ? {
            kind: b.kind,
            originalSha256: b.originalSha256,
            physicalPage: b.physicalPage,
            physicalPages: b.physicalPages,
            pageSha256: b.pageSha256,
          }
        : {}),
    }));
}
