import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
const generateObject = vi.fn();
vi.mock("@/lib/ai/generateObject", () => ({
  generateObject: (...a: unknown[]) => generateObject(...a),
}));
const { judgeCitedAnswer } = await import("@/lib/evals/judgeCitedAnswer");
const turn = (): ChatTurn => ({
  answer: "The release was on Label X [1].",
  sources: [{ n: 1, title: "Discography", url: "https://a.example" }],
  evidence: [
    {
      n: 1,
      url: "https://a.example",
      text: "Label X released it in 2014.",
      tool: "readSource",
      toolCallId: "t",
      sha256: "hash",
    },
  ],
  firstTextMs: 1,
  totalMs: 2,
});
const input = () => ({
  question: "Which label?",
  reference: "Label X",
  answerable: true,
  turn: turn(),
});
beforeEach(() => {
  generateObject.mockReset();
});
describe("judgeCitedAnswer", () => {
  it("uses the exact captured passage in one judge call", async () => {
    generateObject.mockResolvedValue({
      output: { relevance: 1, groundedness: 1, reason: "Supported by [1]." },
    });
    const result = await judgeCitedAnswer(input());
    expect(result).toMatchObject({ verdict: { groundedness: 1 } });
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(generateObject.mock.calls[0][0].prompt).toContain("Label X released it in 2014.");
  });
  it.each(["missing", "wrong-url", "stream-error", "oversize"])(
    "does not spend or grade incomplete evidence: %s",
    async kind => {
      const x = input();
      if (kind === "missing") x.turn.evidence = [];
      if (kind === "wrong-url") x.turn.evidence![0].url = "https://wrong.example";
      if (kind === "stream-error") x.turn.error = "interrupted";
      if (kind === "oversize") x.turn.evidence![0].text = "x".repeat(96001);
      expect(await judgeCitedAnswer(x)).toMatchObject({
        verdict: null,
        unscoredReason: expect.any(String),
      });
      expect(generateObject).not.toHaveBeenCalled();
    },
  );
  it("records a judge failure as unscored without retrying or leaking provider details", async () => {
    generateObject.mockRejectedValue(new Error("private provider response"));
    expect(await judgeCitedAnswer(input())).toEqual({
      verdict: null,
      unscoredReason: "Judge request failed; semantic scores are unavailable.",
    });
    expect(generateObject).toHaveBeenCalledTimes(1);
  });
  it("fails an empty answer without paying a judge", async () => {
    const x = input();
    x.turn.answer = "";
    expect(await judgeCitedAnswer(x)).toMatchObject({ verdict: { relevance: 0, groundedness: 0 } });
    expect(generateObject).not.toHaveBeenCalled();
  });
});
