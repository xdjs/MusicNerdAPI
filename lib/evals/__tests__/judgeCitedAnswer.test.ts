import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatTurn } from "@/lib/evals/ChatTurn";
import { readChatEvidence } from "@/lib/evals/readChatEvidence";
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
  it("does not repair a misplaced citation with support from an uncited result", async () => {
    // Minimized public excerpts from experiment 89f689f, bio-ritmo-singer.
    // This checks evidence binding, not the mocked judge's semantic accuracy.
    const x = input();
    x.turn.answer = "Rei Alvarez is a native of Puerto Rico [4].";
    x.turn.sources = [
      { n: 2, title: "Bio Ritmo", url: "https://www.bioritmo.com" },
      { n: 4, title: "Bio Ritmo - Wikipedia", url: "https://en.wikipedia.org/wiki/Bio_Ritmo" },
    ];
    x.turn.evidence = readChatEvidence("webSearch", "historical-search", {
      results: [
        {
          ...x.turn.sources[0],
          snippet: "salsa rhythms of Alvarez and Negron’s native Puerto Rico.",
        },
        { ...x.turn.sources[1], snippet: "Rei Alvarez: vocals, guiro (original member)" },
      ],
    });
    generateObject.mockResolvedValue({
      output: { relevance: 1, groundedness: 0, reason: "Fixture verdict; not a model evaluation." },
    });
    await judgeCitedAnswer(x);
    const evidence = JSON.parse(generateObject.mock.calls[0][0].prompt).evidence;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ n: 4, url: x.turn.sources[1].url });
    expect(evidence[0].text).not.toContain("Puerto Rico");
  });

  it("carries original publication metadata through capture into the judge request", async () => {
    // Exact date from experiment 89f689f, dutchyyy-onchain readSource [1].
    const x = input();
    x.turn.answer = "In a September 2024 post, he discussed archiving his work [1].";
    x.turn.sources = [
      { n: 1, title: "Instagram", url: "https://www.instagram.com/p/DAE8WJESb04/" },
    ];
    x.turn.evidence = readChatEvidence("readSource", "historical-read", {
      ...x.turn.sources[0],
      text: "using tech that felt like a more permanent solution than legacy internet",
      publishedAt: "2024-09-19T00:24:56Z",
      activityDate: null,
      retrievedAt: null,
    });
    generateObject.mockResolvedValue({
      output: { relevance: 1, groundedness: 1, reason: "Fixture verdict; not a model evaluation." },
    });
    await judgeCitedAnswer(x);
    expect(JSON.parse(generateObject.mock.calls[0][0].prompt).evidence[0]).toMatchObject({
      publishedAt: "2024-09-19T00:24:56Z",
      activityDate: null,
      retrievedAt: null,
    });
  });
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
