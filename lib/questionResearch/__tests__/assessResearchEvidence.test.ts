import { it, expect, vi, beforeEach } from "vitest";
import { assessResearchEvidence } from "@/lib/questionResearch/assessResearchEvidence";
const model = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/generateText", () => ({ generateText: model }));
const request = {
  topic: "Album production",
  evidenceNeed: "credits" as const,
  freshness: "stored" as const,
};
const ref = {
  sourceId: "vault:1",
  revision: "a".repeat(64),
  start: 500,
  end: 555,
  text: "The proposed drums were not used on the final recording.",
  url: "https://artist.example/credits",
  curation: "approved" as const,
  evidenceKind: "original_text" as const,
  speaker: "unverified" as const,
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
};
beforeEach(() => {
  vi.resetAllMocks();
});
it("requires literal original support, not a model's unsupported source label", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ sourceId: "vault:1", quote: "Artist produced the track" }],
      identity: [],
      limitation: "none",
    },
    usage: { inputTokens: 100, outputTokens: 20 },
  });
  expect(
    (await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000)).sufficient,
  ).toBe(false);
});
it("retains supporting context and qualifications without turning approval into editorial acceptance", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ sourceId: "vault:1", quote: ref.text }],
      identity: [],
      limitation: "none",
    },
    usage: { inputTokens: 100, outputTokens: 20 },
  });
  const r = await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000);
  expect(r.sufficient).toBe(true);
  expect(r.references[0].text).toContain("not used");
  expect(model.mock.calls[0][0]).toMatchObject({ maxRetries: 0, maxOutputTokens: 1800 });
  expect(model.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal);
});
it("accepts the same contiguous quote when the model collapses whitespace", async () => {
  const spaced = {
    ...ref,
    text: "Dutchyyy built the vault  over a year\n\nto escape platform dependency.",
  };
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [
        {
          sourceId: spaced.sourceId,
          quote: "built the vault over a year to escape platform dependency",
        },
      ],
      identity: [],
      limitation: "none",
    },
    usage: { inputTokens: 100, outputTokens: 20 },
  });
  const result = await assessResearchEvidence(request, [spaced], { name: "Dutchyyy" }, [], 5000);
  expect(result.sufficient).toBe(true);
  expect(result.references).toEqual([spaced]);
});
it("does not convert a provider failure to an absence claim", async () => {
  model.mockRejectedValue(new Error("offline"));
  await expect(
    assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000),
  ).rejects.toThrow();
});
it("does not invoke a model when there are no readable originals", async () => {
  expect((await assessResearchEvidence(request, [], { name: "Artist" }, [], 5000)).sufficient).toBe(
    false,
  );
  expect(model).not.toHaveBeenCalled();
});
