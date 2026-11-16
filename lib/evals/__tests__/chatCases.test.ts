import { describe, expect, it } from "vitest";
import { CHAT_CASES } from "@/lib/evals/chatCases";

describe("CHAT_CASES", () => {
  it("has unique keys", () => {
    const keys = CHAT_CASES.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every fact, in cases and follow-ups, a usable alternative", () => {
    const facts = CHAT_CASES.flatMap(c => [...(c.facts ?? []), ...(c.followUp?.facts ?? [])]);
    expect(facts.length).toBeGreaterThan(0);
    for (const fact of facts) {
      const alternatives = Array.isArray(fact) ? fact : [fact];
      expect(alternatives.some(a => typeof a === "string" && a.trim() !== "")).toBe(true);
    }
  });

  it("marks a question judge-advisory only with a reason and a fact checklist", () => {
    const advisory = CHAT_CASES.filter(c => c.judgeAdvisory !== undefined);
    expect(advisory.map(c => c.key)).toEqual(["willie-colon-blades", "dutchyyy-aliases"]);
    for (const c of advisory) {
      expect(c.judgeAdvisory!.trim().length).toBeGreaterThan(20);
      expect(c.facts?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
