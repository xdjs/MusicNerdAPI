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
});
