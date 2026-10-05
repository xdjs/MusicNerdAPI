import { beforeEach, expect, it, vi } from "vitest";
import { corpus, evidence } from "./evidence";
const call = vi.fn();
vi.mock("../callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { selectInterviewAngles } = await import("../selectInterviewAngles");
const usage = { stage: "editorial", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 1 };
const candidate = {
  observation: "The artist recorded in a stairwell",
  citations: ["c1"],
  connection: { kind: "direct", explanation: "A documented recording choice" },
  alreadyKnown: "The recording location",
  unknown: "What the space changed about the performance",
  payoff: "A concrete musical decision",
  doNotAssume: ["That the space was an improvement"],
  decision: "select",
  reason: "The effect on the performance has not been explained",
};
const options = {
  artist: "Test artist",
  asOf: "2026-01-01",
  purpose: "Music",
  notes: [],
  evidence: corpus().evidence,
  conversation: null,
  model: "critic",
};
beforeEach(() => {
  call.mockReset();
});
it("reads originals, preserves discarded candidates, and restores original evidence", async () => {
  call.mockResolvedValue({
    output: {
      candidates: [candidate, { ...candidate, reason: "Same unknown" }],
      selectedIndexes: [0],
      listening: null,
    },
    call: usage,
  });
  const r = await selectInterviewAngles(options);
  expect(r.candidates).toHaveLength(2);
  expect(r.selectedIndexes).toEqual([0]);
  expect(r.candidates[0].evidence[0]).toEqual({
    evidenceId: "p1",
    quote: options.evidence[0].text,
  });
  expect(call.mock.calls[0][5]).toBe("archive");
  expect(call.mock.calls[0][2].evidence[0].passages[0].text).toBe(options.evidence[0].text);
});
it("rejects fabricated citations and bounds candidate and selected counts", async () => {
  for (const candidates of [
    Array(7).fill({ ...candidate, decision: "discard" }),
    Array(4).fill(candidate),
  ]) {
    call.mockResolvedValue({
      output: { candidates, selectedIndexes: candidates.map((_, i) => i), listening: null },
      call: usage,
    });
    await expect(selectInterviewAngles(options)).rejects.toThrow(/citation|candidate|selected/i);
  }
});
it("anchors listening in the latest exact answer, not the archive or an earlier turn", async () => {
  const conversation = {
    kind: "synthetic" as const,
    artistId: corpus().artist.id,
    label: "Test",
    turns: [
      { speaker: "artist" as const, text: "I chose the room." },
      {
        speaker: "artist" as const,
        text: "The rhythm happened by accident, not because I cannot play it.",
      },
    ],
  };
  const evidenceWithAnswer = [
    ...options.evidence,
    evidence({ id: "conversation:0", kind: "answer", text: conversation.turns[0].text }),
    evidence({ id: "conversation:1", kind: "answer", text: conversation.turns[1].text }),
  ];
  const listening = {
    citations: ["c3"],
    meaning: "An accidental discovery",
    limits: ["Do not infer inability"],
    nextMove: "example",
  };
  call.mockResolvedValue({
    output: { candidates: [candidate], selectedIndexes: [0], listening },
    call: usage,
  });
  const r = await selectInterviewAngles({ ...options, conversation, evidence: evidenceWithAnswer });
  expect(call.mock.calls[0][3].shape.selectedIndexes.safeParse([0, 1]).success).toBe(false);
  expect(r.listening?.anchors[0].quote).toBe(conversation.turns[1].text);
  for (const invalid of [
    null,
    { ...listening, citations: ["c1"] },
    { ...listening, citations: ["c2"] },
  ]) {
    call.mockResolvedValue({
      output: { candidates: [candidate], selectedIndexes: [0], listening: invalid },
      call: usage,
    });
    await expect(
      selectInterviewAngles({ ...options, conversation, evidence: evidenceWithAnswer }),
    ).rejects.toThrow(/latest|listening/i);
  }
  call.mockResolvedValue({
    output: { candidates: [candidate, candidate], selectedIndexes: [0, 1], listening },
    call: usage,
  });
  await expect(
    selectInterviewAngles({ ...options, conversation, evidence: evidenceWithAnswer }),
  ).rejects.toThrow(/selected/i);
});

it("rejects duplicate or out-of-range selections and retains failed model output for private diagnosis", async () => {
  for (const selectedIndexes of [[0, 0], [6], [-1]]) {
    call.mockResolvedValue({
      output: { candidates: [candidate], selectedIndexes, listening: null },
      call: usage,
    });
    await expect(selectInterviewAngles(options)).rejects.toMatchObject({
      editorialFailure: { call: usage },
    });
  }
});
it("accepts a source-qualified passage reference only when both parts resolve exactly", async () => {
  call.mockResolvedValue({
    output: {
      candidates: [{ ...candidate, citations: ["p1#c1"] }],
      selectedIndexes: [0],
      listening: null,
    },
    call: usage,
  });
  expect((await selectInterviewAngles(options)).candidates[0].evidence[0].evidenceId).toBe("p1");
  call.mockResolvedValue({
    output: {
      candidates: [{ ...candidate, citations: ["another-source#c1"] }],
      selectedIndexes: [0],
      listening: null,
    },
    call: usage,
  });
  const rejected = await selectInterviewAngles(options);
  expect(rejected.selectedIndexes).toEqual([]);
  expect(rejected.candidates[0].rejectedCitations).toEqual(["another-source#c1"]);
  expect(rejected.candidates[0].evidence).toEqual([]);
});
it("isolates an invalid candidate without discarding independently valid selected angles", async () => {
  call.mockResolvedValue({
    output: {
      candidates: [{ ...candidate, citations: ["fabricated"] }, candidate],
      selectedIndexes: [0, 1],
      listening: null,
    },
    call: usage,
  });
  const r = await selectInterviewAngles(options);
  expect(r.selectedIndexes).toEqual([1]);
  expect(r.candidates[0].decision).toBe("discard");
  expect(r.candidates[0].validationError).toMatch(/citation/i);
  expect(r.candidates[1].decision).toBe("select");
});
