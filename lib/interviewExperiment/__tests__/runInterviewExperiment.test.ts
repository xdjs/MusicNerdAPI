import { beforeEach, describe, expect, it, vi } from "vitest";
import { corpus, evidence } from "./evidence";
const call = vi.fn();
vi.mock("@/lib/interviewExperiment/callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { runInterviewExperiment } = await import("@/lib/interviewExperiment/runInterviewExperiment");
const draft = {
  question: "What did that room change about your drums?",
  whyAsk: "A concrete recording choice",
  unknown: "What the room contributed",
  evidence: [{ evidenceId: "p1", quote: "I recorded drums alone in a stairwell." }],
};
const response = (output: unknown) => ({
  output,
  call: { stage: "test", elapsedMs: 1, inputTokens: 100, outputTokens: 100, promptBytes: 1000 },
});
const verdict = {
  index: 0,
  supported: true,
  attributionCorrect: true,
  respectsCorrections: true,
  notAlreadyAnswered: true,
  worthwhile: true,
  reason: "supported",
};
beforeEach(() => call.mockReset());
describe("runInterviewExperiment", () => {
  it("gives the writer and checker original prior answers and corrections", async () => {
    call
      .mockResolvedValueOnce(response({ questions: [draft] }))
      .mockResolvedValueOnce(response({ verdicts: [verdict] }));
    const c = corpus([
      evidence(),
      evidence({ id: "a", kind: "answer", text: "I already explained the echo." }),
      evidence({ id: "c", kind: "correction", text: "REJECTED CLAIM: debut in 2010." }),
    ]);
    const result = await runInterviewExperiment(c, "context");
    expect(result.questions).toEqual([draft]);
    expect(call.mock.calls[0][2].evidence.map((e: any) => e.kind)).toEqual([
      "correction",
      "answer",
      "post",
    ]);
    expect(call.mock.calls[1][2].evidence.map((e: any) => e.text)).toEqual(
      call.mock.calls[0][2].evidence.map((e: any) => e.text),
    );
  });
  it("fails closed for missing/duplicate verdicts and questions already answered", async () => {
    for (const verdicts of [
      [],
      [verdict, verdict],
      [{ ...verdict, notAlreadyAnswered: false, reason: "already answered" }],
    ]) {
      call
        .mockResolvedValueOnce(response({ questions: [draft] }))
        .mockResolvedValueOnce(response({ verdicts }));
      expect((await runInterviewExperiment(corpus(), "context")).questions).toEqual([]);
    }
  });
  it("never uses hallucinated source ids or quote text", async () => {
    call.mockResolvedValueOnce(
      response({
        questions: [
          { ...draft, evidence: [{ evidenceId: "invention", quote: "An invented connection" }] },
        ],
      }),
    );
    const result = await runInterviewExperiment(corpus(), "context");
    expect(result.questions).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("searches older originals without making invented planner ids into evidence", async () => {
    call
      .mockResolvedValueOnce(
        response({
          leads: [
            { sourceIds: ["invented"], query: "stairwell", whyInvestigate: "A recording space" },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ questions: [draft] }))
      .mockResolvedValueOnce(response({ verdicts: [verdict] }));
    const result = await runInterviewExperiment(corpus(), "connections");
    expect(result.searches).toEqual(["stairwell"]);
    expect(result.evidenceIds).toEqual(["p1"]);
    expect(result.questions).toHaveLength(1);
  });
  it("abstains without paying a model when cutoff leaves no source material", async () => {
    const result = await runInterviewExperiment(corpus(), "context", { asOf: "2020-01-01" });
    expect(result.questions).toEqual([]);
    expect(call).not.toHaveBeenCalled();
  });
  it("does not send unknown reel speech as artist attribution", async () => {
    call.mockResolvedValueOnce(response({ questions: [] }));
    await runInterviewExperiment(
      corpus([evidence({ kind: "transcript", attribution: "speaker unverified" })]),
      "context",
    );
    expect(call.mock.calls[0][2].evidence[0].attribution).toBe("speaker unverified");
  });
});

it("round-trips short prompt references without changing source text, dates, URL or attribution", async () => {
  call
    .mockResolvedValueOnce(
      response({
        questions: [{ ...draft, evidence: [{ evidenceId: "e1", quote: draft.evidence[0].quote }] }],
      }),
    )
    .mockResolvedValueOnce(response({ verdicts: [verdict] }));
  const original = evidence();
  const result = await runInterviewExperiment(corpus([original]), "context");
  expect(call.mock.calls[0][2].evidence[0]).toEqual({ ...original, id: "e1" });
  expect(result.questions[0].evidence[0].evidenceId).toBe(original.id);
  expect(result.evidenceIds).toEqual([original.id]);
});
