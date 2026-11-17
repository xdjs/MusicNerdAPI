import { describe, expect, test } from "vitest";
import { toRetrievalFailure } from "@/lib/evals/toRetrievalFailure";

const facts = [
  { fact: "f", anyOf: [{ sourceKind: "vault" as const, sourceId: "s", locator: "p1" }] },
];

describe("toRetrievalFailure", () => {
  test("carries the allowlisted diagnostic, never a drizzle query message", () => {
    const secret = "SECRET question text and 0.0123,0.456";
    const error = new Error(
      `Failed query: select * from source_units where text = $1\nparams: art-1,${secret}`,
      { cause: new Error("connection reset") },
    );
    const row = toRetrievalFailure({ facts, answerable: true }, error);
    expect(row.error).toBe("Error");
    expect(JSON.stringify(row)).not.toContain("Failed query");
    expect(JSON.stringify(row)).not.toContain("SECRET");
    expect(JSON.stringify(row)).not.toContain("params");
  });

  test("scores every fact as not found, with no hits", () => {
    const row = toRetrievalFailure({ facts, answerable: true }, new Error("x"));
    expect(row.hits).toEqual([]);
    expect(row.weak).toBe(false);
    expect(row.facts).toEqual([{ fact: "f", found: false, rank: null }]);
  });

  test("never echoes a thrown non-error", () => {
    expect(toRetrievalFailure({ facts: [], answerable: false }, "secret string").error).toBe(
      "non-error thrown",
    );
  });
});
