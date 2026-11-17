import { describe, expect, test } from "vitest";
import { mergeSearchHits } from "@/lib/chat/mergeSearchHits";
import { unitHit } from "@/lib/units/__tests__/fixtures/unitHit";

const ids = (hits: { sourceId: string; unitIndex: number }[]) =>
  hits.map(h => `${h.sourceId}${h.unitIndex}`);

describe("mergeSearchHits", () => {
  test("keeps the primary whole and appends the first `extra` new secondary hits in order", () => {
    const merged = mergeSearchHits(
      [unitHit("a", 0), unitHit("b", 0)],
      [unitHit("c", 0), unitHit("d", 0), unitHit("e", 0)],
      2,
    );
    expect(ids(merged)).toEqual(["a0", "b0", "c0", "d0"]);
  });

  test("skips duplicates without counting them against extra", () => {
    const merged = mergeSearchHits(
      [unitHit("a", 0), unitHit("b", 1)],
      [unitHit("b", 1), unitHit("a", 0), unitHit("a", 1), unitHit("c", 0)],
      2,
    );
    expect(ids(merged)).toEqual(["a0", "b1", "a1", "c0"]);
  });

  test("adds nothing when extra is 0", () => {
    expect(ids(mergeSearchHits([unitHit("a", 0)], [unitHit("b", 0)], 0))).toEqual(["a0"]);
  });

  test("handles empty lists", () => {
    expect(mergeSearchHits([], [], 6)).toEqual([]);
    expect(ids(mergeSearchHits([], [unitHit("b", 0), unitHit("c", 0)], 1))).toEqual(["b0"]);
    expect(ids(mergeSearchHits([unitHit("a", 0)], [], 6))).toEqual(["a0"]);
  });
});
