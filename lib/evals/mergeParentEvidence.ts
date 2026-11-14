import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { scoreCitations } from "@/lib/evals/scorers/scoreCitations";

/**
 * A follow-up answered from the conversation may cite a document number from its parent turn,
 * for which it has no evidence of its own. For each cited number the follow-up has no evidence
 * row for, adds the parent's rows (and its source entry if the follow-up has none). When the two
 * turns give different URLs for a number, the follow-up's own entry wins and nothing is merged.
 */
export function mergeParentEvidence(turn: ChatTurn, parent: ChatTurn): ChatTurn {
  if (!parent.evidence) return turn;
  const cited = scoreCitations(turn.answer, [
    ...new Set([...turn.sources, ...parent.sources].map(s => s.n)),
  ]).metadata.cited;
  const evidence = [...(turn.evidence ?? [])];
  const sources = [...turn.sources];
  let changed = false;
  for (const n of cited) {
    if (evidence.some(e => e.n === n)) continue;
    const own = sources.find(s => s.n === n);
    const inherited = parent.sources.find(s => s.n === n);
    if (!inherited || (own && own.url !== inherited.url)) continue;
    const rows = parent.evidence.filter(e => e.n === n && e.url === inherited.url);
    if (!rows.length) continue;
    evidence.push(...rows);
    if (!own) sources.push(inherited);
    changed = true;
  }
  if (!changed) return turn;
  evidence.sort((a, b) => a.n - b.n);
  sources.sort((a, b) => a.n - b.n);
  return { ...turn, evidence, sources };
}
