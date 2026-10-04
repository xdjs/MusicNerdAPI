import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { corpus, evidence } from "./evidence";
import type { InterviewMemory } from "../types";
const call = vi.fn();
vi.mock("@/lib/interviewExperiment/callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { runPreparedInterview } = await import("../runPreparedInterview");
const c = corpus();
const memory: InterviewMemory = {
  version: 1,
  promptVersion: "reading-v1",
  artistId: c.artist.id,
  corpusHash: createHash("sha256").update(JSON.stringify(c)).digest("hex"),
  asOf: c.capturedAt,
  model: "test",
  documents: [],
  sections: [],
};
const draft = {
  question: "What did the stairwell change in how you played?",
  whyAsk: "A creative consequence",
  unknown: "How playing changed",
  citations: ["c1"],
};
const dossier = {
  alreadyExplained: [],
  angles: [
    {
      observation: "A stairwell recording",
      unknown: draft.unknown,
      whyAsk: draft.whyAsk,
      assumptionsToAvoid: [],
      citations: ["c1"],
    },
  ],
  discarded: [],
  gaps: [],
};
const response = (output: unknown) => ({
  output,
  call: { stage: "test", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 1 },
});
beforeEach(() => {
  call.mockReset();
});
it("carries the exact latest correction through every stage and rejects ignored corrections", async () => {
  call
    .mockResolvedValueOnce(
      response({ leads: [{ sourceIds: ["p1"], query: "stairwell", whyInvestigate: "Process" }] }),
    )
    .mockResolvedValueOnce(response(dossier))
    .mockResolvedValueOnce(response({ questions: [draft] }))
    .mockResolvedValueOnce(
      response({
        verdicts: [
          {
            index: 0,
            supported: true,
            temporalAccuracy: true,
            premises: [{ claim: "Recorded drums", status: "supported", reason: "Source" }],
            attributionCorrect: true,
            respectsCorrections: false,
            notAlreadyAnswered: true,
            worthwhile: true,
            respondsToAnswer: false,
            respectsBoundaries: true,
            reason: "Artist corrected the premise",
          },
        ],
      }),
    );
  const conversation = {
    kind: "synthetic",
    artistId: c.artist.id,
    label: "Correction test",
    turns: [{ speaker: "artist", text: "That stairwell story was not about my recording." }],
  };
  const result = await runPreparedInterview(c, {
    purpose: "Discuss recording decisions",
    memory,
    conversation,
  });
  expect(result.questions).toEqual([]);
  expect(result.rejected[0].reason).toBe("Artist corrected the premise");
  for (const invocation of call.mock.calls)
    expect(invocation[2].conversation.turns).toEqual(conversation.turns);
  expect(result.calls).toHaveLength(4);
});
it("never drafts from fabricated dossier quotes and records the discarded angle", async () => {
  call.mockResolvedValueOnce(response({ leads: [] })).mockResolvedValueOnce(
    response({
      ...dossier,
      angles: [
        {
          ...dossier.angles[0],
          citations: ["invented-ref"],
        },
      ],
    }),
  );
  const result = await runPreparedInterview(c, { purpose: "Music", memory });
  expect(result.questions).toEqual([]);
  expect(call).toHaveBeenCalledTimes(2);
  expect(result.preparation!.dossier.discarded.join(" ")).toMatch(/Unknown evidence/i);
});
it("allows a single grounded next question but fails closed on missing boundary verdict", async () => {
  for (const respectsBoundaries of [true, false, undefined]) {
    call
      .mockResolvedValueOnce(response({ leads: [] }))
      .mockResolvedValueOnce(response(dossier))
      .mockResolvedValueOnce(
        response({ questions: [draft, { ...draft, question: "Another question?" }] }),
      )
      .mockResolvedValueOnce(
        response({
          verdicts: [0, 1].map(index => ({
            index,
            supported: true,
            temporalAccuracy: true,
            premises: [{ claim: "Recorded drums", status: "supported", reason: "Source" }],
            attributionCorrect: true,
            respectsCorrections: true,
            notAlreadyAnswered: true,
            worthwhile: true,
            respondsToAnswer: true,
            respectsBoundaries,
            reason: "Checked",
          })),
        }),
      );
    const result = await runPreparedInterview(c, {
      purpose: "Music",
      memory,
      conversation: {
        kind: "synthetic",
        artistId: c.artist.id,
        label: "Listening test",
        turns: [{ speaker: "artist", text: "The room made me leave more space." }],
      },
    });
    expect(result.questions).toHaveLength(respectsBoundaries ? 1 : 0);
  }
});

it("withholds future published answers and their saved reading notes from all model stages", async () => {
  const source = evidence({
    id: "interview",
    kind: "lore",
    text: "Why drums? Because the room was echoing. SECRET NEXT ANSWER",
    group: "interview-source",
  });
  const archive = corpus([source, evidence()]);
  const saved: InterviewMemory = {
    ...memory,
    corpusHash: createHash("sha256").update(JSON.stringify(archive)).digest("hex"),
    documents: [{ sourceId: source.id, characters: source.text.length }],
    sections: [
      {
        sourceId: source.id,
        start: 0,
        end: source.text.length,
        notes: [{ kind: "prior-answer", point: "SECRET NEXT ANSWER", quote: "SECRET NEXT ANSWER" }],
        call: response({}).call,
      },
    ],
  };
  call
    .mockResolvedValueOnce(response({ leads: [] }))
    .mockResolvedValueOnce(response({ ...dossier, angles: [] }));
  const result = await runPreparedInterview(archive, {
    purpose: "Music",
    memory: saved,
    conversation: {
      kind: "published",
      artistId: archive.artist.id,
      sourceId: source.id,
      turns: [{ speaker: "artist", text: "Because the room was echoing.", start: 11, end: 40 }],
    },
  });
  for (const invocation of call.mock.calls)
    expect(JSON.stringify(invocation[2])).not.toContain("SECRET NEXT ANSWER");
  expect(result.preparation!.withheldIds).toEqual([source.id]);
});
