import type { ExpectedUnit, RetrievalFact } from "@/lib/evals/retrievalLabels";

/** A retrieved unit as the scorer reads it. */
type Hit = Pick<ExpectedUnit, "sourceKind" | "sourceId" | "locator">;

/** One fact's result: whether any of its units was retrieved, and the 1-based rank of the first. */
export type FactResult = { fact: string; found: boolean; rank: number | null };

const sameUnit = (hit: Hit, unit: ExpectedUnit) =>
  hit.sourceKind === unit.sourceKind &&
  hit.sourceId === unit.sourceId &&
  hit.locator.replace(/\s+/g, "") === unit.locator.replace(/\s+/g, "");

/**
 * Scores one retrieval row against its facts. A fact is found when any one of its units is among
 * the hits (same source kind, source id and locator, whitespace ignored in the locator).
 *
 * @param output - The search's hits, best first, and its `weak` flag.
 * @param expected - The case's facts and whether its sources can answer it.
 * @returns `recall`: facts found over facts (with no facts: 1 for an unanswerable case the search
 * called weak, else 0); `reciprocalRank`: 1 over the rank of the first hit that satisfies any fact,
 * 0 when none does; `facts`: each fact's result, in label order.
 */
export function scoreRetrievalFacts(
  output: { hits: Hit[]; weak: boolean },
  expected: { facts: RetrievalFact[]; answerable: boolean },
): { recall: number; reciprocalRank: number; facts: FactResult[] } {
  const facts = expected.facts.map(f => {
    const index = output.hits.findIndex(hit => f.anyOf.some(unit => sameUnit(hit, unit)));
    return { fact: f.fact, found: index !== -1, rank: index === -1 ? null : index + 1 };
  });
  const ranks = facts.flatMap(f => (f.rank === null ? [] : [f.rank]));
  const recall =
    facts.length === 0
      ? !expected.answerable && output.weak
        ? 1
        : 0
      : facts.filter(f => f.found).length / facts.length;
  return { recall, reciprocalRank: ranks.length ? 1 / Math.min(...ranks) : 0, facts };
}
