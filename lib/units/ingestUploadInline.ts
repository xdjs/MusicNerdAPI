import { inspectChatPdf } from "@/lib/chatPdf/inspectChatPdf";
import { ingestSource } from "@/lib/units/ingestSource";
import { queueUnitSync } from "@/lib/units/queueUnitSync";
import { INLINE_INGEST_MAX_PAGES } from "@/lib/units/types";

const isText = (type: string) => type.startsWith("text/") || type === "application/json";

async function fitsInline(bytes: Buffer, contentType: string): Promise<boolean> {
  if (isText(contentType)) return true;
  if (contentType !== "application/pdf") return false;
  try {
    const pages = await inspectChatPdf(bytes, AbortSignal.timeout(30_000));
    return pages <= INLINE_INGEST_MAX_PAGES;
  } catch {
    // Over the read limit or unreadable here: leave it to the queued job.
    return false;
  }
}

/**
 * Index a just-saved upload now when it is small, otherwise queue a `unit_sync` job.
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
      await ingestSource({ sourceKind: "vault", sourceId: input.sourceId }, { bytes: input.bytes });
      return;
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
