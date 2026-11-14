import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { scoreCitations } from "@/lib/evals/scorers/scoreCitations";

/**
 * A follow-up answered from the conversation may cite a document number from its parent turn
 * without having read it again. For each number the answer cites that the follow-up has a source
 * entry for (the server re-sent it) with the same URL as the parent's, and no evidence row for,
 * adds the parent's evidence rows for it. `sources` is never changed, so a number the follow-up
 * has no source for stays missing and the citations gate still fails it; a number whose URL
 * differs between the turns merges nothing.
 */
export function mergeParentEvidence(turn: ChatTurn, parent: ChatTurn): ChatTurn {
  if (!parent.evidence) return turn;
  const cited = scoreCitations(turn.answer, [...new Set(turn.sources.map(s => s.n))]).metadata
    .cited;
  const evidence = [...(turn.evidence ?? [])];
  let changed = false;
  for (const n of cited) {
    if (evidence.some(e => e.n === n)) continue;
    const own = turn.sources.find(s => s.n === n);
    const inherited = parent.sources.find(s => s.n === n);
    if (!own || !inherited || own.url !== inherited.url) continue;
    const rows = parent.evidence.filter(e => e.n === n && e.url === inherited.url);
    if (!rows.length) continue;
    evidence.push(...rows);
    changed = true;
  }
  if (!changed) return turn;
  evidence.sort((a, b) => a.n - b.n);
  return { ...turn, evidence };
}
