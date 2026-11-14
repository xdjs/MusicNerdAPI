import { describe, expect, it } from "vitest";
import { formatRetrievalReport } from "@/lib/evals/formatRetrievalReport";

describe("formatRetrievalReport", () => {
  it("prints one row per case with a found/total facts column, then one line per missed fact", () => {
    const lines = formatRetrievalReport([
      {
        key: "a",
        labelled: true,
        hits: 8,
        weak: false,
        scores: { recall_at_8: 0.5, reciprocal_rank: 1 },
        facts: [
          { fact: "one", found: true, rank: 1 },
          { fact: "two", found: false, rank: null },
        ],
      },
      {
        key: "b",
        labelled: false,
        hits: 0,
        weak: true,
        scores: { recall_at_8: 1, reciprocal_rank: 0 },
        facts: [],
      },
      {
        key: "c",
        labelled: true,
        hits: null,
        weak: null,
        error: "boom",
        scores: {},
        facts: [{ fact: "three", found: false, rank: null }],
      },
    ]);
    expect(lines[0].split(/\s+/)).toEqual([
      "case",
      "hits",
      "facts",
      "recall",
      "rank",
      "weak",
      "labelled",
    ]);
    expect(lines[1].split(/\s+/)).toEqual(["a", "8", "1/2", "0.5", "1", "false", "yes"]);
    expect(lines[2].split(/\s+/)).toEqual(["b", "0", "0/0", "1", "0", "true", "no"]);
    expect(lines[3]).toMatch(/^c\s+-\s+0\/1\s+-\s+-\s+-\s+yes\s+error: boom$/);
    expect(lines.slice(4)).toEqual(["missed: a: two", "missed: c: three"]);
  });

  it("prints no missed lines when every fact is found", () => {
    const lines = formatRetrievalReport([
      {
        key: "a",
        labelled: true,
        hits: 1,
        weak: false,
        scores: { recall_at_8: 1, reciprocal_rank: 1 },
        facts: [{ fact: "one", found: true, rank: 1 }],
      },
    ]);
    expect(lines).toHaveLength(2);
  });
});
