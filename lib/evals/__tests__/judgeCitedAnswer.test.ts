import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
const generateObject = vi.fn();
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const mockDimensions = Object.fromEntries(
  [
    "citedSupport",
    "requestedInventoryCoverage",
    "counterevidenceHandling",
    "uncertaintyHandling",
    "responseUsability",
  ].map(name => [name, { score: 0.5, reason: "Synthetic diagnostic, not semantic proof." }]),
);
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
      sha256: hash("Label X released it in 2014."),
    },
  ],
  evidenceCaptureComplete: true,
  capture: { complete: true, reads: [{ toolCallId: "t", tool: "readSource", complete: true }] },
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
      output: { ...mockDimensions, relevance: 1, groundedness: 1, reason: "Supported by [1]." },
    });
    const result = await judgeCitedAnswer(input());
    expect(result).toMatchObject({ verdict: { groundedness: 1 } });
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(generateObject.mock.calls[0][0].prompt).toContain("Label X released it in 2014.");
  });
  it("sends uncited read evidence for completeness without treating it as citation support", async () => {
    const x = input();
    x.turn.sources.push({ n: 2, title: "Earlier account", url: "https://b.example" });
    x.turn.evidence!.push({
      ...x.turn.evidence![0],
      n: 2,
      url: "https://b.example",
      text: "An earlier release used Label Y in 2012.",
      toolCallId: "other-read",
      sha256: hash("An earlier release used Label Y in 2012."),
    });
    generateObject.mockResolvedValue({
      output: {
        ...mockDimensions,
        relevance: 0.5,
        groundedness: 1,
        reason: "Scripted judge response, not semantic proof.",
      },
    });
    x.turn.capture!.reads.push({ toolCallId: "other-read", tool: "readSource", complete: true });
    await judgeCitedAnswer(x);
    const request = generateObject.mock.calls[0][0];
    const packet = JSON.parse(request.prompt);
    expect(packet.evidence).toEqual(x.turn.evidence);
    expect(packet.citedSupport).toEqual([{ n: 1, evidenceIndexes: [0] }]);
    expect(request.instructions).toContain("all captured read evidence, including uncited sources");
    expect(request.instructions).toContain("cannot rescue an incorrect citation");
    expect(request.instructions).toContain("reference can be incomplete or wrong");
  });
  it("preserves repeated read windows for the same citation", async () => {
    const x = input();
    x.turn.evidence!.push({
      ...x.turn.evidence![0],
      text: "The later paragraph qualifies the date.",
      toolCallId: "second-window",
      sha256: hash("The later paragraph qualifies the date."),
    });
    generateObject.mockResolvedValue({
      output: { ...mockDimensions, relevance: 1, groundedness: 1, reason: "Scripted." },
    });
    x.turn.capture!.reads.push({ toolCallId: "second-window", tool: "readSource", complete: true });
    await judgeCitedAnswer(x);
    expect(JSON.parse(generateObject.mock.calls[0][0].prompt).evidence).toEqual(x.turn.evidence);
  });
  it.each([
    "uncited-missing",
    "uncited-pdf",
    "uncited-foreign",
    "uncited-ambiguous",
    "uncited-oversize",
  ])("does not pay a judge when all-read capture is incomplete or too large: %s", async kind => {
    const x = input();
    x.turn.sources.push({
      n: 2,
      title: kind === "uncited-pdf" ? "original.pdf" : "Other",
      url: "https://b.example",
    });
    if (!["uncited-missing", "uncited-pdf"].includes(kind))
      x.turn.evidence!.push({
        ...x.turn.evidence![0],
        n: 2,
        url: "https://b.example",
        text: kind === "uncited-oversize" ? "x".repeat(96000) : "Contrary account.",
        toolCallId: "other",
      });
    if (kind === "uncited-foreign") x.turn.evidence!.at(-1)!.url = "https://foreign.example";
    if (kind === "uncited-ambiguous")
      x.turn.sources.push({ n: 2, title: "Ambiguous", url: "https://other.example" });
    expect(await judgeCitedAnswer(x)).toMatchObject({
      verdict: null,
      unscoredReason: expect.any(String),
    });
    expect(generateObject).not.toHaveBeenCalled();
  });
  it("rejects an evidence row with no matching source even when it is uncited", async () => {
    const x = input();
    x.turn.evidence!.push({
      ...x.turn.evidence![0],
      n: 3,
      url: "https://foreign.example",
      toolCallId: "foreign",
    });
    expect(await judgeCitedAnswer(x)).toMatchObject({ verdict: null });
    expect(generateObject).not.toHaveBeenCalled();
  });
  it.each([false, undefined])(
    "does not infer complete capture from shared URLs or historical records: %s",
    async complete => {
      const x = input();
      x.turn.evidenceCaptureComplete = complete;
      if (complete === undefined) x.turn.capture = undefined;
      expect(await judgeCitedAnswer(x)).toMatchObject({ verdict: null });
      expect(generateObject).not.toHaveBeenCalled();
    },
  );
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
      output: { ...mockDimensions, relevance: 1, groundedness: 1, reason: "Supported" },
    });
    await judgeCitedAnswer(x);
    expect(JSON.parse(generateObject.mock.calls[0][0].prompt).evidence).toEqual(x.turn.evidence);
  });
  it("records a judge failure as unscored without retrying or leaking provider details", async () => {
    generateObject.mockRejectedValue(new Error("private provider response"));
    expect(await judgeCitedAnswer(input())).toMatchObject({
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
