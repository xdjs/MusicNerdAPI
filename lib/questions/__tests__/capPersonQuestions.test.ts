import { describe, it, expect } from "vitest";
import { capPersonQuestions } from "@/lib/questions/capPersonQuestions";

describe("capPersonQuestions", () => {
  it("keeps at most half (rounded up) about somebody else when other kinds exist", () => {
    const items = [
      { kind: "credit", id: 1 },
      { kind: "partnership", id: 2 },
      { kind: "collaborator", id: 3 },
      { kind: "statement", id: 4 },
    ];
    expect(capPersonQuestions(items, 3).map(x => x.id)).toEqual([1, 2, 4]);
  });

  it("leaves an all-collaborator set alone", () => {
    const items = [{ kind: "credit" }, { kind: "partnership" }, { kind: "same_post" }];
    expect(capPersonQuestions(items, 3)).toHaveLength(3);
  });
});
