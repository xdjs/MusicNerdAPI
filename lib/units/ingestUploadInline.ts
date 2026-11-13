import { inspectChatPdf } from "@/lib/chatPdf/inspectChatPdf";
import { ingestSource } from "@/lib/units/ingestSource";
import { queueUnitSync } from "@/lib/units/queueUnitSync";
import { INLINE_INGEST_MAX_PAGES } from "@/lib/units/types";
import { PDF_PARSE_TIMEOUT_MS } from "@/lib/vaultUpload/const";

const isText = (type: string) => type.startsWith("text/") || type === "application/json";

async function fitsInline(bytes: Buffer, contentType: string): Promise<boolean> {
  if (isText(contentType)) return true;
  if (contentType !== "application/pdf") return false;
  try {
    const pages = await inspectChatPdf(bytes, AbortSignal.timeout(5_000));
    return pages <= INLINE_INGEST_MAX_PAGES;
  } catch {
    // Over the read limit or unreadable here: leave it to the queued job.
    return false;
  }
}

/**
 * Index a just-saved upload now when it is small, otherwise queue a `unit_sync` job. The job is
 * also queued when the inline pass needs OCR, failed, or wrote units it could not embed.
 * Never rejects: an upload that was saved must still succeed.
 *
 * @param input - The saved vault row id, its artist, and the uploaded bytes and type.
 */
export async function ingestUploadInline(input: {
  sourceId: string;
  artistId: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  try {
    if (await fitsInline(input.bytes, input.contentType)) {
      const outcome = await ingestSource(
        { sourceKind: "vault", sourceId: input.sourceId },
        {
          bytes: input.bytes,
          ocr: false,
          signal: AbortSignal.timeout(20_000),
          pdfTimeoutMs: PDF_PARSE_TIMEOUT_MS,
        },
      );
      // Units written without embeddings are filled by the job's re-embed pass.
      const unembedded = outcome.units > 0 && !outcome.embedded;
      if (outcome.skipped !== "needs-ocr" && !outcome.failed && !unembedded) return;
    }
    await queueUnitSync(input.artistId);
  } catch (caught) {
    console.warn(
      `[units] Inline ingest failed for source ${input.sourceId}; queueing`,
      caught instanceof Error ? caught.name : "error",
    );
    try {
      await queueUnitSync(input.artistId);
    } catch {
      console.warn(`[units] Could not queue unit_sync for source ${input.sourceId}`);
    }
  }
}
