import type { ChatDocumentRef } from "@/lib/chat/createChatDocuments";
import { type HistoryMessage, keepCurrentPdfTurns } from "@/lib/chat/keepCurrentPdfTurns";
import type { ArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { findCurrentDocuments } from "@/lib/units/findCurrentDocuments";

const refKey = (ref: { sourceKind: string; sourceId: string }) =>
  `${ref.sourceKind}:${ref.sourceId}`;
const revisionKey = (ref: { sourceKind: string; sourceId: string; revision: string }) =>
  `${refKey(ref)}:${ref.revision}`;

/**
 * The conversation the model may see, and the documents it has numbered. An earlier answer that
 * cited the artist's documents stays only while every one is still public at the revision it was
 * numbered at, so a follow-up never replays evidence the fan could no longer open; an answer that
 * read a PDF goes through `keepCurrentPdfTurns` first, as before. Every distinct document in the
 * history is looked up in one query (`findCurrentDocuments`), none when there are none.
 *
 * @param messages - The validated body's messages.
 * @param artistId - The artist the conversation is about.
 * @returns The messages to send, without `documents` or `pdfReads`; and `prior`, the documents of
 *   the kept answers by ascending `n`, each document once at its first number (a number already
 *   held by another document is left out, so `createChatDocuments` can always re-register them).
 */
export async function keepCurrentCitedTurns(
  messages: ArtistChatBody["messages"],
  artistId: string,
): Promise<{ messages: HistoryMessage[]; prior: { n: number; ref: ChatDocumentRef }[] }> {
  const lookups = new Map<string, Pick<ChatDocumentRef, "sourceKind" | "sourceId" | "revision">>();
  // Only answers cite documents; whatever a user message carries is neither looked up nor judged.
  const cites = (message: ArtistChatBody["messages"][number]) =>
    message.role === "assistant" ? (message.documents ?? []) : [];
  for (const message of messages)
    for (const { sourceKind, sourceId, revision } of cites(message))
      lookups.set(revisionKey({ sourceKind, sourceId, revision }), {
        sourceKind,
        sourceId,
        revision,
      });
  // keepCurrentPdfTurns returns the kept messages rebuilt; their ids are replaced by indexes
  // here so each maps back to its message (and documents) even when the client repeats ids.
  const [pdfKept, current] = await Promise.all([
    keepCurrentPdfTurns(
      messages.map((message, index) => ({ ...message, id: String(index) })),
      artistId,
    ),
    lookups.size ? findCurrentDocuments(artistId, [...lookups.values()]) : new Set<string>(),
  ]);

  const kept = pdfKept
    .map(({ id }) => messages[Number(id)])
    .filter(message => cites(message).every(ref => current.has(revisionKey(ref))));

  const prior: { n: number; ref: ChatDocumentRef }[] = [];
  const numbered = new Set<string>();
  const taken = new Set<number>();
  const cited = kept.flatMap(cites).sort((a, b) => a.n - b.n);
  for (const { n, ...ref } of cited) {
    if (numbered.has(refKey(ref)) || taken.has(n)) continue;
    numbered.add(refKey(ref));
    taken.add(n);
    prior.push({ n, ref });
  }
  return { messages: kept.map(({ id, role, parts }) => ({ id, role, parts })), prior };
}
