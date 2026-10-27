import { describe, it, expect, vi } from "vitest";

const generateObject = vi.fn();
vi.mock("@/lib/ai/generateObject", () => ({
  generateObject: (...a: unknown[]) => generateObject(...a),
}));
const { judgeAnswer } = await import("@/lib/evals/judgeAnswer");

describe("judgeAnswer", () => {
  it("asks the gateway model for a verdict on the answer against the hand-checked reference", async () => {
    generateObject.mockResolvedValueOnce({
      output: { relevance: 1, groundedness: 0.8, reason: "ok" },
    });
    const verdict = await judgeAnswer({
      question: "Where is Bio Ritmo from?",
      reference: "Richmond, Virginia, since 1991.",
      answerable: true,
      answer: "Richmond, Virginia [1].",
    });
    expect(verdict).toEqual({ relevance: 1, groundedness: 0.8, reason: "ok" });
    const call = generateObject.mock.calls[0][0];
    expect(call.model).toBeUndefined();
    expect(call.temperature).toBe(0);
    expect(call.prompt).toContain("Where is Bio Ritmo from?");
    expect(call.prompt).toContain("Richmond, Virginia, since 1991.");
    expect(call.prompt).toContain("Richmond, Virginia [1].");
    expect(call.schema.safeParse({ relevance: 2, groundedness: 0, reason: "" }).success).toBe(
      false,
    );
  });

  it("tells the judge when the stored sources cannot answer, so a plain 'not found' is grounded", async () => {
    generateObject.mockResolvedValueOnce({ output: { relevance: 1, groundedness: 1, reason: "" } });
    await judgeAnswer({
      question: "q",
      reference: "Not in the sources.",
      answerable: false,
      answer: "",
    });
    expect(generateObject.mock.calls.at(-1)?.[0].prompt).toContain("cannot answer");
  });
});
