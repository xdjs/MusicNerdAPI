import { describe, expect, it } from "vitest";
import { mergeParentEvidence } from "@/lib/evals/mergeParentEvidence";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import type { ChatEvidence } from "@/lib/evals/ChatEvidence";

const ev = (n: number, url: string, text = "t"): ChatEvidence => ({
  n,
  url,
  text,
  tool: "readSource",
  toolCallId: `c${n}`,
  sha256: "x",
});
const turn = (
  answer: string,
  sources: ChatTurn["sources"],
  evidence?: ChatEvidence[],
): ChatTurn => ({
  answer,
  sources,
  evidence,
  firstTextMs: 0,
  totalMs: 0,
});
const src = (n: number, url: string) => ({ n, title: `T${n}`, url });

describe("mergeParentEvidence", () => {
  it("leaves numbers the follow-up already evidences untouched", () => {
    const t = turn("A [1].", [src(1, "u1")], [ev(1, "u1", "own")]);
    const p = turn("", [src(1, "u1")], [ev(1, "u1", "parent")]);
    expect(mergeParentEvidence(t, p)).toEqual(t);
  });

  it("adds the parent's rows for a number the follow-up re-sent with the same URL, never a source", () => {
    const t = turn("A [1][2].", [src(1, "u1"), src(2, "u2")], [ev(1, "u1")]);
    const p = turn("", [src(2, "u2")], [ev(2, "u2"), ev(2, "u2", "second"), ev(3, "u3")]);
    const merged = mergeParentEvidence(t, p);
    expect(merged.sources).toEqual([src(1, "u1"), src(2, "u2")]);
    expect(merged.evidence).toEqual([ev(1, "u1"), ev(2, "u2"), ev(2, "u2", "second")]);
  });

  it("leaves a number the follow-up has no source for missing, and adds no source", () => {
    const t = turn("A [1][2].", [src(1, "u1")], [ev(1, "u1")]);
    const p = turn("", [src(2, "u2")], [ev(2, "u2")]);
    const merged = mergeParentEvidence(t, p);
    expect(merged.sources).toEqual([src(1, "u1")]);
    expect(merged.evidence).toEqual([ev(1, "u1")]);
  });

  it("keeps the follow-up's own source and adds only missing evidence", () => {
    const t = turn("A [2].", [src(2, "u2")], []);
    const p = turn("", [src(2, "u2")], [ev(2, "u2")]);
    const merged = mergeParentEvidence(t, p);
    expect(merged.sources).toEqual([src(2, "u2")]);
    expect(merged.evidence).toEqual([ev(2, "u2")]);
  });

  it("leaves a number neither turn has missing", () => {
    const t = turn("A [5].", [], []);
    const p = turn("", [src(1, "u1")], [ev(1, "u1")]);
    const merged = mergeParentEvidence(t, p);
    expect(merged.evidence).toEqual([]);
    expect(merged.sources).toEqual([]);
  });

  it("merges nothing when the turns give different URLs for the number", () => {
    const t = turn("A [1].", [src(1, "own")], [ev(1, "own")]);
    const p = turn("", [src(1, "other")], [ev(1, "other")]);
    expect(mergeParentEvidence(t, p)).toEqual(t);
  });

  it("returns the turn when the parent has no evidence or the turn errored", () => {
    const t = turn("A [1].", [src(1, "u1")], undefined);
    expect(mergeParentEvidence(t, turn("", [src(1, "u1")], undefined))).toEqual(t);
  });
});
