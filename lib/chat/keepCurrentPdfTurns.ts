import type { ArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { loadChatPdfs } from "@/lib/chatPdf/loadChatPdfs";

type Message = ArtistChatBody["messages"][number];
/** A message as `convertToModelMessages` takes it: the check's bookkeeping removed. */
export type HistoryMessage = Pick<Message, "id" | "role" | "parts">;

/**
 * The conversation the model may see. An earlier answer that read a PDF stays only while
 * every document it read is still published for this artist at the revision it read; one
 * whose document was withdrawn or changed is dropped, as every PDF answer was before, so a
 * follow-up can never replay evidence the fan could no longer open. This is the same
 * eligibility check the read tool makes before each model step.
 *
 * @param messages - The validated body's messages.
 * @param artistId - The artist the conversation is about.
 * @returns The messages to send, without `pdfReads`.
 */
export async function keepCurrentPdfTurns(
  messages: ArtistChatBody["messages"],
  artistId: string,
): Promise<HistoryMessage[]> {
  const kept: HistoryMessage[] = [];
  const revisions = new Map<string, Promise<string | undefined>>();
  const currentRevision = (sourceId: string) => {
    let revision = revisions.get(sourceId);
    if (!revision) {
      revision = loadChatPdfs(artistId, sourceId).then(sources => sources[0]?.revision);
      revisions.set(sourceId, revision);
    }
    return revision;
  };
  for (const { id, role, parts, pdfReads } of messages) {
    if (pdfReads?.length) {
      const current = await Promise.all(
        pdfReads.map(async read => (await currentRevision(read.sourceId)) === read.revision),
      );
      if (!current.every(Boolean)) continue;
    }
    kept.push({ id, role, parts });
  }
  return kept;
}
