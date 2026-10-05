import { createHash } from "node:crypto";
import { prepareInterviewConversation } from "./prepareInterviewConversation";
import { selectInterviewEvidence } from "./selectInterviewEvidence";
import { prepareInterviewCitations } from "./prepareInterviewCitations";
import type { InterviewCorpus } from "./types";

/** Build a complete bounded archive; fail instead of silently replacing it with retrieved snippets.
 * @param corpus - Immutable original snapshot.
 * @param options - Date cutoff and optional provenance-checked replay.
 * @returns Full eligible sources, reversible citations, archive identity and separate current turns.
 */
export function buildInterviewArchive(
  corpus: InterviewCorpus,
  options: { asOf?: string; conversation?: unknown } = {},
) {
  if (new Set(corpus.evidence.map(e => e.id)).size !== corpus.evidence.length)
    throw new Error("Duplicate archive source identity");
  const asOf = options.asOf ?? corpus.capturedAt;
  const replay = prepareInterviewConversation(corpus, options.conversation);
  if (
    replay.conversation?.kind === "published" &&
    !selectInterviewEvidence(corpus.evidence, asOf, Number.MAX_SAFE_INTEGER).some(
      e => e.id === replay.conversation!.sourceId,
    )
  )
    throw new Error("Replay source is outside the assignment cutoff");
  const evidence = selectInterviewEvidence(replay.corpus.evidence, asOf, Number.MAX_SAFE_INTEGER);
  const catalog = prepareInterviewCitations(evidence);
  if (Buffer.byteLength(JSON.stringify(catalog.sources), "utf8") > 450000)
    throw new Error(
      "The complete archive exceeds the full-read budget; do not silently truncate it",
    );
  return {
    evidence,
    catalog,
    asOf,
    corpusHash: createHash("sha256")
      .update(JSON.stringify({ corpus: replay.corpus, asOf }))
      .digest("hex"),
    conversation: replay.conversation,
    withheldIds: replay.withheldIds,
  };
}
