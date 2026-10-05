import { beforeEach, expect, it, vi } from "vitest";
import { corpus } from "./evidence";
const call = vi.fn();
vi.mock("../callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { reviewGroundedInterview } = await import("../reviewGroundedInterview");
const usage = { stage: "review", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 1 };
const latest = "I heard a rhythm I could not have played on purpose.";
const verdict = {
  index: 0,
  supported: true,
  attributionCorrect: true,
  respectsCorrections: true,
  notAlreadyAnswered: true,
  worthwhile: true,
  temporalAccuracy: true,
  respondsToAnswer: true,
  respectsBoundaries: true,
  singleQuestion: true,
  acknowledgesConflicts: true,
  reason: "Supported",
  premises: [{ claim: "An accidental discovery", status: "supported", reason: "Latest answer" }],
  meaningChecks: [
    {
      sourceQuote: latest,
      interpretation: "The rhythm emerged unexpectedly",
      faithful: true,
      reason: "Preserves intention without asserting inability",
    },
  ],
};
const options = {
  artist: "Test",
  asOf: corpus().capturedAt,
  purpose: "Music",
  evidence: corpus().evidence,
  questions: [
    {
      question: "Can you describe a rhythm that surprised you?",
      whyAsk: "Hear an example",
      unknown: "An example of the discovery",
      evidence: [],
    },
  ],
  conversation: {
    kind: "synthetic" as const,
    artistId: corpus().artist.id,
    label: "Test",
    turns: [{ speaker: "artist" as const, text: latest }],
  },
  editorial: true,
  model: "critic",
};
beforeEach(() => {
  call.mockReset();
});
it("accepts a grounded interpretation and exposes exact verdicts for private audit", async () => {
  call.mockResolvedValue({ output: { verdicts: [verdict] }, call: usage });
  const r = await reviewGroundedInterview(options);
  expect(r.rejections).toEqual([null]);
  expect(r.verdicts).toEqual([verdict]);
  expect(call.mock.calls[0][2].questions[0].unknown).toBe(options.questions[0].unknown);
});
it("rejects meaning changes even when all broad factual booleans pass", async () => {
  call.mockResolvedValue({
    output: {
      verdicts: [
        {
          ...verdict,
          meaningChecks: [
            {
              ...verdict.meaningChecks[0],
              interpretation: "The rhythm is physically unplayable",
              faithful: false,
              reason: "Intention is not ability",
            },
          ],
        },
      ],
    },
    call: usage,
  });
  expect((await reviewGroundedInterview(options)).rejections[0]).toMatch(
    /Intention is not ability/,
  );
});
it("fails closed on missing, duplicate or unanchored meaning checks", async () => {
  for (const verdicts of [
    [],
    [verdict, verdict],
    [{ ...verdict, meaningChecks: [] }],
    [
      {
        ...verdict,
        meaningChecks: [{ ...verdict.meaningChecks[0], sourceQuote: "An invented artist answer" }],
      },
    ],
  ]) {
    call.mockResolvedValue({ output: { verdicts }, call: usage });
    expect((await reviewGroundedInterview(options)).rejections[0]).not.toBeNull();
  }
});
it("does not require a conversation anchor for an opening or the legacy comparison path", async () => {
  const { meaningChecks: _checks, ...oldVerdict } = verdict;
  call.mockResolvedValue({ output: { verdicts: [oldVerdict] }, call: usage });
  expect((await reviewGroundedInterview({ ...options, editorial: false })).rejections).toEqual([
    null,
  ]);
  call.mockResolvedValue({
    output: { verdicts: [{ ...verdict, meaningChecks: [] }] },
    call: usage,
  });
  expect((await reviewGroundedInterview({ ...options, conversation: null })).rejections).toEqual([
    null,
  ]);
});
