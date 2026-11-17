import { RRF_K, type UnitHit } from "@/lib/units/types";

/**
 * Reciprocal rank fusion: each unit scores Σ 1/(k + rank) over the lists it appears in (rank from
 * 1; a unit counts once per list, at its best rank there).
 *
 * @param lists - Ranked hit lists, best first.
 * @param k - The fusion constant; larger flattens the gap between ranks.
 * @returns One hit per `(sourceKind, sourceId, unitIndex)` with the fused score and the fields of its
 * first appearance, highest score first, ties in order of first appearance.
 */
export function fuseRanks(lists: UnitHit[][], k = RRF_K): UnitHit[] {
  const fused = new Map<string, UnitHit>();
  for (const list of lists) {
    const seen = new Set<string>();
    list.forEach((hit, i) => {
      const key = `${hit.sourceKind}\u0000${hit.sourceId}\u0000${hit.unitIndex}`;
      if (seen.has(key)) return;
      seen.add(key);
      const contribution = 1 / (k + i + 1);
      const prior = fused.get(key);
      if (prior) prior.score += contribution;
      else fused.set(key, { ...hit, score: contribution });
    });
  }
  // Array.prototype.sort is stable, and the map iterates in first-appearance order.
  return [...fused.values()].sort((a, b) => b.score - a.score);
}
