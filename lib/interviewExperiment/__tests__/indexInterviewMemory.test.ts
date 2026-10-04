import { beforeEach, expect, it, vi } from "vitest";
import { corpus, evidence } from "./evidence";
const call = vi.fn();
vi.mock("@/lib/interviewExperiment/callInterviewModel", () => ({
  callInterviewModel: (...args: unknown[]) => call(...args),
}));
const { indexInterviewMemory } = await import("../indexInterviewMemory");
const { validateInterviewMemory } = await import("../validateInterviewMemory");
beforeEach(() => {
  call.mockReset().mockImplementation(async (_stage, _instruction, payload) => ({
    output: {
      notes: [
        {
          kind: "observation",
          point: "A source-linked observation",
          quote: payload.section.text.slice(0, 100),
        },
      ],
    },
    call: { stage: "read", elapsedMs: 1, inputTokens: 1, outputTokens: 1, promptBytes: 100 },
  }));
});
it("reads the beginning, middle and end of every long document without coverage gaps", async () => {
  const text =
    "START musical process.\n" +
    "Middle sentence about recording.\n".repeat(1300) +
    "END: This recording was unrelated to the movie.";
  const c = corpus([evidence({ id: "pdf", kind: "lore", text }), evidence()]);
  const memory = await indexInterviewMemory(c);
  const seen = new Set<number>();
  for (const section of memory.sections) {
    expect(
      call.mock.calls.some(c => c[2].section.text === text.slice(section.start, section.end)),
    ).toBe(true);
    for (let i = section.start; i < section.end; i++) seen.add(i);
  }
  expect(seen.size).toBe(text.length);
  expect(memory.documents).toEqual([{ sourceId: "pdf", characters: text.length }]);
  expect(() => validateInterviewMemory(c, memory, c.capturedAt)).not.toThrow();
});
it("rejects stale, cross-artist, incomplete and fabricated-quote memory", async () => {
  const c = corpus([evidence({ kind: "lore" })]);
  const memory = await indexInterviewMemory(c);
  for (const changed of [
    { ...c, artist: { ...c.artist, id: "other" } },
    corpus([evidence({ kind: "lore", text: "Corrected new source text" })]),
  ])
    expect(() => validateInterviewMemory(changed, memory, c.capturedAt)).toThrow();
  expect(() => validateInterviewMemory(c, { ...memory, sections: [] }, c.capturedAt)).toThrow();
  memory.sections[0].notes[0].quote = "Invented, absent quotation";
  expect(() => validateInterviewMemory(c, memory, c.capturedAt)).toThrow();
});
it("filters future sources and refuses invalid notes instead of caching invented memories", async () => {
  const c = corpus([evidence({ kind: "lore", availableAt: "2030-01-01" })]);
  expect((await indexInterviewMemory(c)).sections).toEqual([]);
  expect(call).not.toHaveBeenCalled();
  call.mockResolvedValueOnce({
    output: { notes: [{ kind: "observation", point: "Fake", quote: "These words are invented" }] },
    call: {},
  });
  await expect(indexInterviewMemory(corpus([evidence({ kind: "lore" })]))).rejects.toThrow(
    /quote/i,
  );
});

it("resumes a validated partial reading without paying again for completed sections", async () => {
  const c = corpus([evidence({ kind: "lore", text: "A recording detail.\n".repeat(1800) })]);
  const complete = await indexInterviewMemory(c);
  const partial = { ...complete, sections: complete.sections.slice(0, 1) };
  call.mockClear();
  const resumed = await indexInterviewMemory(c, { resume: partial });
  expect(call).toHaveBeenCalledTimes(complete.sections.length - 1);
  expect(resumed.sections[0]).toEqual(complete.sections[0]);
  expect(() => validateInterviewMemory(c, resumed, c.capturedAt)).not.toThrow();
  await expect(
    indexInterviewMemory(c, { resume: { ...partial, artistId: "other" } }),
  ).rejects.toThrow();
});
