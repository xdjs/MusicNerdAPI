import type { UnitHit } from "@/lib/units/types";

/** A unit hit for tests; `doc` and `unit` pick the identity, the rest is filler. */
export const unitHit = (
  doc: string,
  unit: number,
  score = 1,
  sourceKind: UnitHit["sourceKind"] = "vault",
): UnitHit => ({
  sourceKind,
  sourceId: doc,
  sourceRevision: "rev",
  unitIndex: unit,
  locator: `p. ${unit + 1}`,
  title: `Doc ${doc}`,
  url: `https://example.com/${doc}`,
  text: `text ${doc} ${unit}`,
  score,
});
