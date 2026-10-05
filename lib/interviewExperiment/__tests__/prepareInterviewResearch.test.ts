import { beforeEach, expect, it, vi } from "vitest";
import { corpus, evidence } from "./evidence";
const call = vi.fn();
vi.mock("../callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { prepareInterviewResearch } = await import("../prepareInterviewResearch");
const { validateInterviewResearch } = await import("../validateInterviewResearch");
const output = {
  notes: [
    {
      statement: "A 2024 stairwell recording",
      status: "supported",
      timeScope: "2024",
      citations: ["c1"],
    },
  ],
  angles: [
    {
      noteIndexes: [0],
      unknown: "How the room was selected",
      whyAsk: "An unexplained musical choice",
    },
  ],
  gaps: [],
};
beforeEach(() => {
  call.mockReset().mockResolvedValue({
    output,
    call: { stage: "research", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 1 },
  });
});
it("reads complete originals and binds a reusable ledger to exact inputs", async () => {
  const c = corpus([
    evidence(),
    evidence({ id: "late", text: "A later statement contradicts an earlier claim." }),
  ]);
  const result = await prepareInterviewResearch(c, { purpose: "Music", model: "test" });
  expect(result.sourceIds).toEqual(["p1", "late"]);
  expect(call.mock.calls[0][2].evidence[1].passages[0].text).toBe(c.evidence[1].text);
  expect(call.mock.calls[0][5]).toBe("archive");
  expect(validateInterviewResearch(c, result, { purpose: "Music" })).toEqual(result);
  expect(() => validateInterviewResearch(c, result, { purpose: "Different purpose" })).toThrow(
    /assignment/i,
  );
  expect(() =>
    validateInterviewResearch(
      corpus([evidence({ text: "The source changed after preparation." })]),
      result,
      { purpose: "Music" },
    ),
  ).toThrow(/stale/i);
  expect(() =>
    validateInterviewResearch(c, { ...result, sourceIds: ["p1"] }, { purpose: "Music" }),
  ).toThrow(/coverage/i);
});
it("rejects fabricated citations and angles that refer to absent notes", async () => {
  call.mockResolvedValueOnce({
    output: { ...output, notes: [{ ...output.notes[0], citations: ["invented"] }] },
    call: {},
  });
  await expect(
    prepareInterviewResearch(corpus(), { purpose: "Music", model: "test" }),
  ).rejects.toThrow(/citation/i);
  call.mockResolvedValueOnce({
    output: { ...output, angles: [{ ...output.angles[0], noteIndexes: [7] }] },
    call: { stage: "research", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 1 },
  });
  await expect(
    prepareInterviewResearch(corpus(), { purpose: "Music", model: "test" }),
  ).rejects.toThrow(/angle/i);
});
it("reuses archive preparation across synthetic turns but never across published withholding", async () => {
  const c = corpus();
  const r = await prepareInterviewResearch(c, { purpose: "Music", model: "test" });
  expect(
    validateInterviewResearch(c, r, {
      purpose: "Music",
      conversation: {
        kind: "synthetic",
        artistId: c.artist.id,
        label: "Test only",
        turns: [{ speaker: "artist", text: "I do not want to discuss that recording." }],
      },
    }),
  ).toEqual(r);
  expect(() =>
    validateInterviewResearch(c, r, {
      purpose: "Music",
      conversation: {
        kind: "published",
        artistId: c.artist.id,
        sourceId: "p1",
        turns: [
          { speaker: "artist", text: c.evidence[0].text, start: 0, end: c.evidence[0].text.length },
        ],
      },
    }),
  ).toThrow(/stale/i);
});
it("will not prepare an oversized archive or empty assignment", async () => {
  await expect(prepareInterviewResearch(corpus(), { purpose: "", model: "test" })).rejects.toThrow(
    /purpose/i,
  );
  await expect(
    prepareInterviewResearch(corpus([evidence({ text: "x".repeat(500000) })]), {
      purpose: "Music",
      model: "test",
    }),
  ).rejects.toThrow(/complete archive/i);
  expect(call).not.toHaveBeenCalled();
});
