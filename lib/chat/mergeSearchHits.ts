import type { UnitHit } from "@/lib/units/types";

/**
 * Joins two searches of one answer without fusing them: every hit of `primary`, in order, then the
 * first `extra` hits of `secondary` that `primary` does not already hold (same `sourceKind`,
 * `sourceId` and `unitIndex`), in `secondary`'s order. Nothing else is reordered. The primary
 * search's ranking is the measured one (staging 2026-11-15: the user's question alone held a
 * required passage in its top twelve, but fusing it with the model's query pushed that passage out,
 * because rank fusion rewards units found by every list), so it is kept whole and the secondary
 * only adds.
 *
 * @param primary - The hits whose ranking is kept.
 * @param secondary - The hits that may add to it.
 * @param extra - The most secondary hits to add; skipped duplicates do not count against it.
 * @returns The primary hits followed by the added secondary hits.
 */
export function mergeSearchHits(
  primary: UnitHit[],
  secondary: UnitHit[],
  extra: number,
): UnitHit[] {
  const keyOf = (hit: UnitHit) => `${hit.sourceKind}\u0000${hit.sourceId}\u0000${hit.unitIndex}`;
  const held = new Set(primary.map(keyOf));
  const added: UnitHit[] = [];
  for (const hit of secondary) {
    if (added.length >= extra) break;
    const key = keyOf(hit);
    if (held.has(key)) continue;
    held.add(key);
    added.push(hit);
  }
  return [...primary, ...added];
}
