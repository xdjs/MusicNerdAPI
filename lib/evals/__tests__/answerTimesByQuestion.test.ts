import { describe, expect, it } from "vitest";
import { answerTimesByQuestion } from "@/lib/evals/answerTimesByQuestion";

describe("answerTimesByQuestion", () => {
  it("gives each question the mean of its trials, in first-seen order", () => {
    expect(
      answerTimesByQuestion([
        { key: "a", totalMs: 4000 },
        { key: "b", totalMs: 9000 },
        { key: "a", totalMs: 6000 },
      ]),
    ).toEqual([5000, 9000]);
  });

  it("leaves out rows that ended in an error or carry no time", () => {
    expect(
      answerTimesByQuestion([
        { key: "a", totalMs: 4000 },
        { key: "a", totalMs: 1, error: "429 limit" },
        { key: "b", totalMs: 1, error: "429 limit" },
        { key: "c" },
      ]),
    ).toEqual([4000]);
  });
});
