import { boilerplateReason } from "@/lib/questions/boilerplateReason";
import type { EligibleDraft, SignalCandidate } from "@/lib/questions/types";

/**
 * Joins the model's answers back to our candidates. Only a signalId we
 * supplied is honoured, each once, and one signal per question: a link the
 * model draws between two signals is a guess. Boilerplate is flagged, not
 * dropped, because a dropped draft is replaced by a generic question.
 *
 * @param answers - The model's reply, fields unchecked.
 * @param byId - Our candidates by signalId.
 * @returns The usable answers, in the model's order.
 */
export function resolveAnswers(
  answers: { signalId?: unknown; question?: unknown; rationale?: unknown }[],
  byId: Map<string, SignalCandidate>,
): EligibleDraft[] {
  const eligible: EligibleDraft[] = [];
  const resolved = new Set<string>();
  for (const answer of answers) {
    const question = typeof answer.question === "string" ? answer.question.trim() : "";
    const signalId = typeof answer.signalId === "string" ? answer.signalId : null;
    if (!signalId || !question || resolved.has(signalId)) continue;
    const candidate = byId.get(signalId);
    if (!candidate) continue;
    resolved.add(signalId);
    eligible.push({
      candidate,
      question,
      rationale: typeof answer.rationale === "string" ? answer.rationale : "",
      boilerplate: boilerplateReason(question),
    });
  }
  return eligible;
}
