import { beforeEach, expect, it, vi } from "vitest";
import { corpus, evidence } from "./evidence";
import { buildInterviewArchive } from "../buildInterviewArchive";
import type { InterviewResearch } from "../types";
const call = vi.fn();
vi.mock("../callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { runGroundedInterview } = await import("../runGroundedInterview");
const c = corpus();
const usage = { stage: "test", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 1 };
const research: InterviewResearch = {
  version: 1,
  promptVersion: "grounded-v1",
  artistId: c.artist.id,
  corpusHash: buildInterviewArchive(c).corpusHash,
  asOf: c.capturedAt,
  purpose: "Music",
  model: "test",
  sourceIds: ["p1"],
  characters: c.evidence[0].text.length,
  notes: [
    {
      statement: "A stairwell recording",
      status: "supported",
      timeScope: "2024",
      evidence: [{ evidenceId: "p1", quote: c.evidence[0].text }],
    },
  ],
  angles: [{ noteIndexes: [0], unknown: "How the room was selected", whyAsk: "Musical decision" }],
  gaps: [],
  call: usage,
};
const draft = {
  question: "How did you choose that stairwell?",
  whyAsk: "A creative decision",
  unknown: "How the room was selected",
  citations: ["c1"],
};
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
  premises: [
    { claim: "The recording happened in a stairwell", status: "supported", reason: "Original" },
  ],
  reason: "Supported",
};
const response = (output: unknown) => ({ output, call: usage });
beforeEach(() => {
  call.mockReset();
});
it("replaces stale angle rationale after a current answer and after a repair", async () => {
  const conversation = {
    kind: "synthetic",
    artistId: c.artist.id,
    label: "Corrected angle",
    turns: [
      {
        speaker: "artist",
        text: "The room was not my decision. Ask me about the vocal recording.",
      },
    ],
  };
  const revised = {
    ...draft,
    question: "How did you record the vocals?",
    whyAsk: "Follow the invitation to discuss vocal recording",
    unknown: "The vocal recording approach",
  };
  const repaired = {
    ...revised,
    question: "What were you listening for during the vocal take?",
    unknown: "What guided the vocal take",
  };
  call
    .mockResolvedValueOnce(response(revised))
    .mockResolvedValueOnce(
      response({
        verdicts: [{ ...verdict, worthwhile: false, reason: "Ask for a concrete decision" }],
      }),
    )
    .mockResolvedValueOnce(response(repaired))
    .mockResolvedValueOnce(response({ verdicts: [verdict] }));
  const r = await runGroundedInterview(c, { purpose: "Music", research, conversation });
  expect(call.mock.calls[1][2].questions[0]).toMatchObject({
    whyAsk: revised.whyAsk,
    unknown: revised.unknown,
  });
  expect(call.mock.calls[3][2].questions[0]).toMatchObject({
    whyAsk: repaired.whyAsk,
    unknown: repaired.unknown,
  });
  expect(r.questions[0].unknown).toBe(repaired.unknown);
});
it("repairs compound drafts once and checks the repaired question against the full archive", async () => {
  call
    .mockResolvedValueOnce(
      response({ ...draft, question: "How did you choose the room, and what did it change?" }),
    )
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(response({ verdicts: [verdict] }));
  const r = await runGroundedInterview(c, {
    purpose: "Music",
    research,
    model: "test",
    reviewModel: "critic",
  });
  expect(r.questions.map(q => q.question)).toEqual([draft.question]);
  expect(r.rejected).toHaveLength(1);
  expect(call.mock.calls.map(c => c[0])).toEqual([
    "grounded-draft",
    "grounded-repair",
    "grounded-review",
  ]);
  expect(call.mock.calls[1][2].failure).toMatch(/one question/i);
  expect(call.mock.calls[2][2].evidence).toEqual(c.evidence);
  expect(call.mock.calls[2][4]).toBe("critic");
  expect(call.mock.calls[2][5]).toBe("archive");
  expect(r.grounding?.reviews).toEqual([
    { attempt: "repair", questions: [draft.question], verdicts: [verdict] },
  ]);
});
it("caps three failed angles at eight drafting and review calls, keeping both review rounds", async () => {
  const failed = [0, 1, 2].map(index => ({
    ...verdict,
    index,
    supported: false,
    reason: "Unsupported setup",
  }));
  call.mockImplementation(async (stage: string) =>
    response(stage === "grounded-review" ? { verdicts: failed } : draft),
  );
  const r = await runGroundedInterview(c, {
    purpose: "Music",
    research: { ...research, angles: Array(3).fill(research.angles[0]) },
  });
  expect(call).toHaveBeenCalledTimes(8);
  expect(r.questions).toEqual([]);
  expect(r.rejected).toHaveLength(6);
  expect(r.grounding?.reviews.map(v => v.attempt)).toEqual(["draft", "repair"]);
});
it("restores window citations to full originals and pins saved corrections in the writer packet", async () => {
  const long = evidence({
    id: "book",
    kind: "lore",
    text:
      "Opening passage.\n".repeat(1000) +
      "The recording happened in a stairwell." +
      "\nClosing passage.".repeat(1000),
  });
  const correction = evidence({
    id: "correction",
    kind: "correction",
    text: "The record was not made in a church.",
  });
  const changed = corpus([long, correction]);
  const archive = buildInterviewArchive(changed);
  const bound = {
    ...research,
    corpusHash: archive.corpusHash,
    sourceIds: archive.evidence.map(e => e.id),
    characters: archive.evidence.reduce((n, e) => n + e.text.length, 0),
    notes: [
      {
        ...research.notes[0],
        evidence: [{ evidenceId: "book", quote: "The recording happened in a stairwell." }],
      },
    ],
  };
  call.mockImplementation(
    async (
      stage: string,
      _instructions: string,
      payload: { evidence: { passages?: { ref: string; text: string }[] }[] },
    ) => {
      if (stage === "grounded-review") return response({ verdicts: [verdict] });
      const passage = payload.evidence
        .flatMap(e => e.passages ?? [])
        .find(p => p.text.includes("stairwell"));
      return response({ ...draft, citations: [passage!.ref] });
    },
  );
  const r = await runGroundedInterview(changed, { purpose: "Music", research: bound });
  expect(r.questions[0].evidence[0].evidenceId).toBe("book");
  expect(JSON.stringify(call.mock.calls[0][2].evidence)).toContain(correction.text);
  expect(call.mock.calls[1][2].evidence).toEqual(archive.evidence);
});
it("never returns a failed repair or enters an unbounded rewrite loop", async () => {
  call
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(
      response({
        verdicts: [
          { ...verdict, respectsCorrections: false, reason: "Artist denied this premise" },
        ],
      }),
    )
    .mockResolvedValueOnce(
      response({ ...draft, question: "Which room did you choose, and why did you choose it?" }),
    );
  const r = await runGroundedInterview(c, { purpose: "Music", research });
  expect(r.questions).toEqual([]);
  expect(r.rejected).toHaveLength(2);
  expect(call).toHaveBeenCalledTimes(3);
});
it("carries exact current turns into writers and full-archive reviewers without regenerating research", async () => {
  const conversation = {
    kind: "synthetic",
    artistId: c.artist.id,
    label: "Boundary test",
    turns: [{ speaker: "artist", text: "Please do not ask about that room." }],
  };
  call
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(
      response({ verdicts: [{ ...verdict, respectsBoundaries: false, reason: "Refused" }] }),
    )
    .mockResolvedValueOnce(response({ question: "", citations: [] }));
  const r = await runGroundedInterview(c, { purpose: "Music", research, conversation });
  expect(r.questions).toEqual([]);
  for (const invocation of call.mock.calls)
    expect(invocation[2].conversation.turns).toEqual(conversation.turns);
  expect(call.mock.calls.some(c => c[0] === "research")).toBe(false);
});
it("fails closed on missing or duplicate review verdicts and rejects unsupported premises despite positive booleans", async () => {
  for (const verdicts of [
    [],
    [verdict, verdict],
    [
      {
        ...verdict,
        premises: [{ claim: "She changed producers", status: "unsupported", reason: "No source" }],
      },
    ],
  ]) {
    call
      .mockReset()
      .mockResolvedValueOnce(response(draft))
      .mockResolvedValueOnce(response({ verdicts }))
      .mockResolvedValueOnce(response({ question: "", citations: [] }));
    const r = await runGroundedInterview(c, { purpose: "Music", research });
    expect(r.questions).toEqual([]);
    expect(r.rejected.length).toBeGreaterThan(0);
  }
});
it("detects changed originals before paid calls and does not draft from unknown citations", async () => {
  await expect(
    runGroundedInterview(corpus([evidence({ text: "Changed source text." })]), {
      purpose: "Music",
      research,
    }),
  ).rejects.toThrow(/stale/i);
  expect(call).not.toHaveBeenCalled();
  call
    .mockResolvedValueOnce(response({ ...draft, citations: ["invented"] }))
    .mockResolvedValueOnce(response({ question: "", citations: [] }));
  expect((await runGroundedInterview(c, { purpose: "Music", research })).questions).toEqual([]);
});

it("selects a new angle before writing and drops discarded preparation angles", async () => {
  const c1 = {
    observation: "A stairwell session",
    citations: ["c1"],
    connection: { kind: "direct", explanation: "A recorded practice" },
    alreadyKnown: "The location",
    unknown: "How the performance adapted",
    payoff: "Hear a musical decision",
    doNotAssume: ["A better result"],
    decision: "select",
    reason: "Concrete unexplained process",
  };
  call
    .mockResolvedValueOnce(
      response({
        candidates: [{ ...c1, reason: "Redundant" }, c1],
        selectedIndexes: [1],
        listening: null,
      }),
    )
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(response({ verdicts: [{ ...verdict, meaningChecks: [] }] }));
  const r = await runGroundedInterview(c, { purpose: "Music", research, editorial: true });
  expect(call.mock.calls.map(c => c[0])).toEqual([
    "editorial-select",
    "grounded-draft",
    "grounded-review",
  ]);
  expect(call.mock.calls[1][2].angle.unknown).toBe(c1.unknown);
  expect(call.mock.calls[1][2].angle.editorial.doNotAssume).toEqual(c1.doNotAssume);
  expect(r.grounding?.editorial?.candidates).toHaveLength(2);
  expect(r.questions).toHaveLength(1);
});

it("rechecks the meaning of a repaired follow-up and stays within five calls", async () => {
  const latest = "The rhythm happened by accident, not because I cannot play it.";
  const conversation = {
    kind: "synthetic",
    artistId: c.artist.id,
    label: "Intention",
    turns: [{ speaker: "artist", text: latest }],
  };
  const candidate = {
    observation: "An accidental rhythm",
    citations: ["c2"],
    connection: { kind: "direct", explanation: "Latest answer" },
    alreadyKnown: "An unexpected discovery",
    unknown: "An example",
    payoff: "Make the account concrete",
    doNotAssume: ["Physical inability"],
    decision: "select",
    reason: "Follow a new detail",
  };
  const wrong = {
    ...verdict,
    meaningChecks: [
      {
        sourceQuote: latest,
        interpretation: "Unable to play it",
        faithful: false,
        reason: "Accident is not inability",
      },
    ],
  };
  call
    .mockResolvedValueOnce(
      response({
        candidates: [candidate],
        selectedIndexes: [0],
        listening: {
          citations: ["c2"],
          meaning: "Unexpected discovery",
          limits: ["Not inability"],
          nextMove: "example",
        },
      }),
    )
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(response({ verdicts: [wrong] }))
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(response({ verdicts: [wrong] }));
  const r = await runGroundedInterview(c, {
    purpose: "Music",
    research,
    editorial: true,
    conversation,
  });
  expect(r.questions).toEqual([]);
  expect(call).toHaveBeenCalledTimes(5);
  expect(r.rejected.every(r => r.reason.includes("Accident is not inability"))).toBe(true);
  expect(call.mock.calls[3][2].listening.limits).toEqual(["Not inability"]);
});

it("honors selection priority and caps three repairs at nine calls including editorial selection", async () => {
  const candidates = ["Room choice", "Microphone placement", "Vocal performance"].map(unknown => ({
    observation: "A stairwell session",
    citations: ["c1"],
    connection: { kind: "direct", explanation: "Recorded practice" },
    alreadyKnown: "Location",
    unknown,
    payoff: "A decision",
    doNotAssume: [],
    reason: "Specific craft unknown",
  }));
  call.mockImplementation(async (stage: string) =>
    response(
      stage === "editorial-select"
        ? { candidates, selectedIndexes: [2, 0, 1], listening: null }
        : stage === "grounded-review"
          ? {
              verdicts: [0, 1, 2].map(index => ({
                ...verdict,
                index,
                worthwhile: false,
                reason: "Already explained",
                meaningChecks: [],
              })),
            }
          : draft,
    ),
  );
  const r = await runGroundedInterview(c, { purpose: "Music", research, editorial: true });
  expect(
    call.mock.calls.filter(c => c[0] === "grounded-draft").map(c => c[2].angle.unknown),
  ).toEqual(["Vocal performance", "Room choice", "Microphone placement"]);
  expect(call).toHaveBeenCalledTimes(9);
  expect(r.questions).toEqual([]);
});

it("locks a compound repair to the first ask and still reviews its meaning", async () => {
  const candidate = {
    observation: "A stairwell recording",
    citations: ["c1"],
    connection: { kind: "direct", explanation: "A known setting" },
    alreadyKnown: "Where it happened",
    unknown: "Choosing the room",
    payoff: "A musical decision",
    doNotAssume: [],
    reason: "Unknown choice",
  };
  const compound = "How did you choose that stairwell, and what did it change?";
  call
    .mockResolvedValueOnce(
      response({ candidates: [candidate], selectedIndexes: [0], listening: null }),
    )
    .mockResolvedValueOnce(response({ ...draft, question: compound }))
    .mockResolvedValueOnce(response(draft))
    .mockResolvedValueOnce(response({ verdicts: [{ ...verdict, meaningChecks: [] }] }));
  const r = await runGroundedInterview(c, { purpose: "Music", research, editorial: true });
  expect(call.mock.calls[2][2].requiredQuestion).toBe(draft.question);
  expect(call.mock.calls[2][3].shape.question).toBeUndefined();
  expect(call.mock.calls[3][0]).toBe("grounded-review");
  expect(r.questions[0].question).toBe(draft.question);
});

it("does not call a writer when the editor selects no angle", async () => {
  call.mockResolvedValueOnce(response({ candidates: [], selectedIndexes: [], listening: null }));
  const r = await runGroundedInterview(c, { purpose: "Music", research, editorial: true });
  expect(r.questions).toEqual([]);
  expect(call).toHaveBeenCalledTimes(1);
});
