import { describe, expect, test } from "vitest";
import { fuseRanks } from "@/lib/units/fuseRanks";
import { unitHit as hit } from "./fixtures/unitHit";

const key = (h: { sourceId: string; unitIndex: number }) => `${h.sourceId}#${h.unitIndex}`;

describe("fuseRanks", () => {
  test("fuseRanks promotes a unit present in both lists", () => {
    const text = [hit("a", 0, 9), hit("b", 0, 8), hit("c", 0, 7)];
    const vector = [hit("d", 0, 0.9), hit("c", 0, 0.8), hit("e", 0, 0.7)];
    const fused = fuseRanks([text, vector], 60);
    expect(fused.map(key)).toEqual(["c#0", "a#0", "d#0", "b#0", "e#0"]);
    expect(fused[0].score).toBeCloseTo(1 / 63 + 1 / 62);
    expect(fused[1].score).toBeCloseTo(1 / 61);
    // The first-seen hit's fields survive; only the score is replaced.
    expect(fused[0]).toMatchObject({ text: "text c 0", locator: "p.1" });
  });

  test("keys by kind, source and unit", () => {
    const fused = fuseRanks([[hit("a", 0), hit("a", 1), hit("a", 0, 1, "social")]]);
    expect(fused).toHaveLength(3);
  });

  test("breaks ties by first appearance", () => {
    const fused = fuseRanks([[hit("a", 0)], [hit("b", 0)], [hit("c", 0)]]);
    expect(fused.map(key)).toEqual(["a#0", "b#0", "c#0"]);
  });

  test("uses RRF_K by default and counts a unit once per list", () => {
    const fused = fuseRanks([[hit("a", 0), hit("a", 0)]]);
    expect(fused).toHaveLength(1);
    expect(fused[0].score).toBeCloseTo(1 / 61);
  });

  test("returns [] for no lists", () => {
    expect(fuseRanks([])).toEqual([]);
    expect(fuseRanks([[], []])).toEqual([]);
  });
});
