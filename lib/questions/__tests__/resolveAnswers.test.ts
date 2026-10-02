import { describe, it, expect } from "vitest";
import { resolveAnswers } from "@/lib/questions/resolveAnswers";
import { candidate } from "@/lib/questions/__tests__/candidate";

const byId = new Map([
  ["a", candidate("a")],
  ["b", candidate("b", "credit")],
]);

describe("resolveAnswers", () => {
  it("joins answers to OUR candidates, first occurrence only, flagging boilerplate", () => {
    const out = resolveAnswers(
      [
        { signalId: "a", question: "  Who pushed back on that?  ", rationale: "r" },
        { signalId: "a", question: "Second", rationale: "r" },
        { signalId: "made_up", question: "Invented", rationale: "r" },
        { signalId: "b", question: "Across 23 posts you did things; what changed?" },
        { question: "no id" },
        { signalId: "b", question: "" },
      ],
      byId,
    );
    expect(out).toEqual([
      {
        candidate: byId.get("a"),
        question: "Who pushed back on that?",
        rationale: "r",
        boilerplate: null,
      },
      {
        candidate: byId.get("b"),
        question: "Across 23 posts you did things; what changed?",
        rationale: "",
        boilerplate: "counts how often something appears",
      },
    ]);
  });
});
