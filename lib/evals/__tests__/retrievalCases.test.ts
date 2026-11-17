import { describe, expect, it } from "vitest";
import { RETRIEVAL_CASES } from "@/lib/evals/retrievalCases";
import { RETRIEVAL_LABELS } from "@/lib/evals/retrievalLabels";

const rows = RETRIEVAL_CASES.flatMap(c => [
  { key: c.key, facts: c.facts, answerable: c.answerable },
  ...(c.followUp ? [{ key: `${c.key}/follow-up`, facts: c.followUp.facts, answerable: true }] : []),
]);

describe("RETRIEVAL_CASES", () => {
  it("labels every answerable question with at least one fact, and the unanswerable one with none", () => {
    for (const r of rows) {
      if (r.answerable) expect(r.facts.length, r.key).toBeGreaterThan(0);
      else expect(r.facts, r.key).toEqual([]);
    }
    expect(rows.find(r => r.key === "dutchyyy-aliases/follow-up")?.facts.length).toBe(1);
  });

  it("takes its facts from the labels module, which has no key without a case", () => {
    for (const r of rows) expect(r.facts, r.key).toBe(RETRIEVAL_LABELS[r.key]);
    expect(Object.keys(RETRIEVAL_LABELS).sort()).toEqual(rows.map(r => r.key).sort());
  });

  it("gives every fact at least one unit", () => {
    for (const r of rows)
      for (const f of r.facts) {
        expect(f.anyOf.length, `${r.key}: ${f.fact}`).toBeGreaterThan(0);
        for (const u of f.anyOf) expect(u.sourceId).toMatch(/^[0-9a-f-]{36}$/);
      }
  });
});
