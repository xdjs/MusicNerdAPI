import { describe, it, expect } from "vitest";
import { selectDrafts } from "@/lib/questions/selectDrafts";
import { eligible } from "@/lib/questions/__tests__/candidate";

describe("selectDrafts", () => {
  it("puts clean drafts ahead of flagged ones and keeps the material", () => {
    const out = selectDrafts(
      [eligible("a", "statement", "too long to be spoken"), eligible("b")],
      2,
    );
    expect(out.map(d => d.key)).toEqual(["social_b", "social_a"]);
    expect(out[1]).toMatchObject({
      demotedFor: "too long to be spoken",
      materials: ["material for a"],
    });
    expect(out[0].demotedFor).toBeUndefined();
  });

  it("holds half the slots for non-person kinds, giving them back when nothing claims them", () => {
    const people = ["p1", "p2", "p3", "p4"].map(id => eligible(id, "credit"));
    expect(selectDrafts([...people, eligible("s1")], 4).map(d => d.key)).toEqual([
      "social_p1",
      "social_p2",
      "social_s1",
      "social_p3",
    ]);
    expect(selectDrafts(people, 4)).toHaveLength(4);
  });

  it("never drafts more than the target", () => {
    expect(
      selectDrafts(
        ["a", "b", "c"].map(id => eligible(id)),
        2,
      ),
    ).toHaveLength(2);
  });
});
