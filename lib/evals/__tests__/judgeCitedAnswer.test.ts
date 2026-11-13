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
  it("uses the same grouped citation syntax as citation integrity scoring", async () => {
    const x = input();
    x.turn.answer = "Label X [1, 2]. Date [2026-05-13].";
    expect(await judgeCitedAnswer(x)).toMatchObject({ verdict: null });
    expect(generateObject).not.toHaveBeenCalled();
    x.turn.answer = "Label X [1, Artist Doc]. Date [2026-05-13].";
    generateObject.mockResolvedValue({
      output: { relevance: 1, groundedness: 1, reason: "Supported" },
    });
    await judgeCitedAnswer(x);
    expect(JSON.parse(generateObject.mock.calls[0][0].prompt).evidence).toEqual(x.turn.evidence);
  });
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

describe("judgeCitedAnswer model", () => {
  it("judges with a model from another family than the chat model, at default sampling, and explains PDF page markers", async () => {
    const { MODEL_CHAT, MODEL_JUDGE } = await import("@/lib/ai/const");
    expect(MODEL_JUDGE.split("/")[0]).not.toBe(MODEL_CHAT.split("/")[0]);
    generateObject.mockResolvedValue({
      output: { relevance: 1, groundedness: 1, reason: "Supported by [1]." },
    });
    const x = input();
    x.turn.answer = "Label X [1, p.2].";
    x.turn.evidence![0] = {
      ...x.turn.evidence![0],
      tool: "readPdfSource",
      text: "[page 2]\nLabel X",
    };
    await judgeCitedAnswer(x);
    const call = generateObject.mock.calls[0][0];
    expect(call.model).toBe(MODEL_JUDGE);
    expect(call).not.toHaveProperty("temperature");
    expect(call.instructions).toMatch(/\[page N\]/);
    expect(call.instructions).toContain("starts with its locator in brackets");
    expect(call.instructions).toContain("[n, §Early years]");
    expect(JSON.parse(call.prompt).evidence[0].text).toBe("[page 2]\nLabel X");
  });

  it("takes a judge model override, for comparing judges", async () => {
    generateObject.mockResolvedValue({
      output: { relevance: 1, groundedness: 1, reason: "Supported by [1]." },
    });
    await judgeCitedAnswer({ ...input(), model: "openai/gpt-5.4" });
    expect(generateObject.mock.calls[0][0].model).toBe("openai/gpt-5.4");
  });
});
