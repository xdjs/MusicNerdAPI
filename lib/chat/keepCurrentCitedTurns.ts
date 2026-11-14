import type { ChatDocumentRef } from "@/lib/chat/createChatDocuments";
import { findCitationNumbers } from "@/lib/chat/findCitationNumbers";
import { type HistoryMessage, keepCurrentPdfTurns } from "@/lib/chat/keepCurrentPdfTurns";
import type { ArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { findCurrentDocuments } from "@/lib/units/findCurrentDocuments";

const refKey = (ref: { sourceKind: string; sourceId: string }) =>
  `${ref.sourceKind}:${ref.sourceId}`;
const revisionKey = (ref: { sourceKind: string; sourceId: string; revision: string }) =>
  `${refKey(ref)}:${ref.revision}`;

/**
 * The conversation the model may see, and the documents it has numbered. An earlier answer that
 * cited the artist's documents stays only while it is current, so a follow-up never replays
 * evidence the fan could no longer open:
 *
 * - An answer's currency set is its own documents plus those of every earlier answer in the
 *   conversation (a running union, oldest first, whether or not the earlier answer is kept), and it
 *   stays only if all of them are still public at the revision they were numbered at. An answer can
 *   re-cite an earlier number from memory, so a withdrawal drops every later answer: conservative by
 *   design.
 * - An answer whose text cites a document form (`[n, p.N]`, `[n, §…]`, `[n, ¶N]`) but carries no
 *   documents at all cannot be checked, and is dropped. A plain `[n]` answer (web, readSource, or a
 *   client that sends text only) stays under the running union.
 * - An answer that read a PDF goes through `keepCurrentPdfTurns` first, as before.
 *
 * Every distinct document in the history is looked up in one query (`findCurrentDocuments`), none
 * when there are none.
 *
 * @param messages - The validated body's messages.
 * @param artistId - The artist the conversation is about.
 * @returns The messages to send, without `documents` or `pdfReads`; `prior`, the documents of
 *   the kept answers by ascending `n`, each document once at its first number (a number already
 *   held by another document is left out, so `createChatDocuments` can always re-register them);
 *   and `highestCitedNumber`, the highest `[n]` any kept answer's text cites (0 for none), above
 *   which new numbers start so a number is never reused in a conversation.
 */
export async function keepCurrentCitedTurns(
  messages: ArtistChatBody["messages"],
  artistId: string,
): Promise<{
  messages: HistoryMessage[];
  prior: { n: number; ref: ChatDocumentRef }[];
  highestCitedNumber: number;
}> {
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

  const pdfKeptIndexes = new Set(pdfKept.map(({ id }) => Number(id)));
  const textOf = (message: ArtistChatBody["messages"][number]) =>
    message.parts.map(part => part.text).join("\n");
  const kept: ArtistChatBody["messages"] = [];
  // False from the first answer that numbered a document no longer current: every later answer goes.
  let unionCurrent = true;
  for (const [index, message] of messages.entries()) {
    const own = cites(message);
    if (own.some(ref => !current.has(revisionKey(ref)))) unionCurrent = false;
    if (!pdfKeptIndexes.has(index)) continue;
    if (message.role === "assistant") {
      if (!unionCurrent) continue;
      const documentForm = findCitationNumbers(textOf(message)).some(c => c.locator !== null);
      if (documentForm && own.length === 0) continue;
    }
    kept.push(message);
  }
  // A loop, not Math.max(...): a long answer can hold more markers than a call has arguments.
  let highestCitedNumber = 0;
  for (const message of kept)
    if (message.role === "assistant")
      for (const { n } of findCitationNumbers(textOf(message)))
        if (n > highestCitedNumber) highestCitedNumber = n;

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
  return {
    messages: kept.map(({ id, role, parts }) => ({ id, role, parts })),
    prior,
    highestCitedNumber,
  };
}
