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
it("rejects a model-invented source ID", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: "reference:invented" }],
      identity: [],
      limitation: "none",
    },
    usage: { inputTokens: 100, outputTokens: 20 },
  });
  expect(await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000)).toMatchObject({
    sufficient: false,
    failure: "invalid_evidence_selection",
  });
});
it("retains supporting context and qualifications without turning approval into editorial acceptance", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: "reference:0" }],
      identity: [],
      limitation: "none",
    },
    usage: { inputTokens: 100, outputTokens: 20 },
  });
  const r = await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000);
  expect(r.sufficient).toBe(true);
  expect(r.references[0].text).toContain("not used");
  expect(model.mock.calls[0][0]).toMatchObject({ maxRetries: 0, maxOutputTokens: 2800 });
  expect(model.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal);
});
it("maps assessor facet assignments onto its final selected reference order", async () => {
  const faceted = {
    ...request,
    topic: "Artist; early production; later production",
    evidenceFacets: [
      { id: "f1" as const, intent: "early production" },
      { id: "f2" as const, intent: "later production" },
    ],
  };
  const later = { ...ref, sourceId: "vault:2", text: "The later record used live drums." };
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: "reference:1" }, { referenceId: "reference:0" }],
      facetCoverage: [
        { id: "f1", referenceIds: ["reference:0"] },
        { id: "f2", referenceIds: ["reference:1"] },
      ],
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(faceted, [ref, later], { name: "Artist" }, [], 5000);
  expect(result.references).toEqual([later, ref]);
  expect(result.facetCoverage).toEqual([
    { id: "f1", referenceIndexes: [1] },
    { id: "f2", referenceIndexes: [0] },
  ]);
});
it("retains useful partial assessor references while refusing full sufficiency for a missing facet", async () => {
  const faceted = {
    ...request,
    topic: "Artist; early production; later production",
    evidenceFacets: [
      { id: "f1" as const, intent: "early production" },
      { id: "f2" as const, intent: "later production" },
    ],
  };
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: "reference:0" }],
      facetCoverage: [
        { id: "f1", referenceIds: ["reference:0"] },
        { id: "f2", referenceIds: [] },
      ],
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(faceted, [ref], { name: "Artist" }, [], 5000);
  expect(result).toMatchObject({
    sufficient: false,
    references: [ref],
    facetCoverage: [
      { id: "f1", referenceIndexes: [0] },
      { id: "f2", referenceIndexes: [] },
    ],
    limitation: "missing_original",
  });
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
          referenceId: "reference:0",
        },
      ],
      identity: [
        {
          sourceId: spaced.sourceId,
          sameArtist: true,
          quote: "built the vault over a year to escape platform dependency",
        },
      ],
      limitation: "none",
    },
    usage: { inputTokens: 100, outputTokens: 20 },
  });
  const result = await assessResearchEvidence(
    request,
    [spaced],
    { name: "Dutchyyy" },
    [spaced.sourceId],
    5000,
  );
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

it("asks for distinct overview activities in one assessment and retains all supported original context", async () => {
  const archive = {
    ...ref,
    sourceId: "archive",
    text: "I still have not found the original WAV for this 2013 recording.",
  };
  const tour = { ...ref, sourceId: "tour", text: "I announced two live shows for next month." };
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [archive, tour].map((_, i) => ({ referenceId: `reference:${i}` })),
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(
    {
      topic: "latest updates",
      evidenceNeed: "reporting",
      freshness: "stored",
      retrieval: "latest",
      answerScope: "overview",
    },
    [archive, tour],
    { name: "Artist" },
    [],
    5000,
  );
  expect(result.references).toEqual([archive, tour]);
  expect(model).toHaveBeenCalledTimes(1);
  expect(model.mock.calls[0][0].instructions).toContain("distinct activities");
  expect(model.mock.calls[0][0].instructions).toContain(
    "Do not stop after the first useful update",
  );
});
it("does not require invented extra activities when only one overview original is supported", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: "reference:0" }],
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(
    {
      topic: "latest updates",
      evidenceNeed: "reporting",
      freshness: "stored",
      retrieval: "latest",
      answerScope: "overview",
    },
    [ref],
    { name: "Artist" },
    [],
    5000,
  );
  expect(result.sufficient).toBe(true);
  expect(result.references).toEqual([ref]);
});
it("rejects an overview selection larger than three windows", async () => {
  const originals = Array.from({ length: 6 }, (_, i) => ({ ...ref, sourceId: `source:${i}` }));
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: originals.map((_, i) => ({ referenceId: `reference:${i}` })),
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(
    {
      topic: "latest updates",
      evidenceNeed: "reporting",
      freshness: "stored",
      retrieval: "latest",
      answerScope: "overview",
    },
    originals,
    { name: "Artist" },
    [],
    5000,
  );
  expect(result).toMatchObject({
    sufficient: false,
    failure: "invalid_evidence_selection",
    references: [],
  });
});
it("treats semantic exclusions as eligibility boundaries before accepting dated latest evidence", async () => {
  model.mockResolvedValue({
    output: { sufficient: false, supports: [], identity: [], limitation: "missing_original" },
    usage: {},
  });
  const request = {
    topic: "other activity excluding the archive project",
    evidenceNeed: "reporting",
    freshness: "stored",
    retrieval: "latest",
    answerScope: "overview",
  } as const;
  const result = await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000);
  expect(result.sufficient).toBe(false);
  expect(model.mock.calls[0][0].instructions).toContain(
    "Apply explicit topic exclusions before deciding sufficiency",
  );
  expect(model.mock.calls[0][0].instructions).toContain(
    "A different URL does not make the same excluded project a new activity",
  );
});

it("selects readable originals without requiring a duplicate generated quotation", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: "reference:0" }],
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000);
  expect(result.sufficient).toBe(true);
  expect(result.references).toEqual([ref]);
});

it("selects exact windows when three saved and four external passages span five sources", async () => {
  const originals = ["vault:1", "vault:2", "vault:3", "new:0", "new:0", "new:1", "new:1"].map(
    (sourceId, i) => ({ ...ref, sourceId, start: i * 100, end: i * 100 + ref.text.length }),
  );
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [0, 1, 2, 4, 6].map(i => ({ referenceId: `reference:${i}` })),
      identity: [
        { sourceId: "new:0", sameArtist: true, quote: ref.text },
        { sourceId: "new:1", sameArtist: true, quote: ref.text },
      ],
      limitation: "none",
    },
    usage: {},
  });
  const result = await assessResearchEvidence(
    request,
    originals,
    { name: "Artist" },
    ["new:0", "new:1"],
    5000,
  );
  expect(result.sufficient).toBe(true);
  expect(result.references).toEqual([0, 1, 2, 4, 6].map(i => originals[i]));
  expect(result.confirmedIds).toEqual(["new:0", "new:1"]);
  const prompt = JSON.parse(model.mock.calls[0][0].prompt);
  expect(prompt.originals[4]).toMatchObject({
    referenceId: "reference:4",
    sourceId: "new:0",
    start: 400,
  });
});
it("does not accept a source ID in place of a window ID", async () => {
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: [{ referenceId: ref.sourceId }],
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  expect(await assessResearchEvidence(request, [ref], { name: "Artist" }, [], 5000)).toMatchObject({
    sufficient: false,
    failure: "invalid_evidence_selection",
    references: [],
  });
});
it("rejects focused over-selection rather than silently removing supporting windows", async () => {
  const originals = Array.from({ length: 7 }, (_, i) => ({ ...ref, sourceId: `source:${i}` }));
  model.mockResolvedValue({
    output: {
      sufficient: true,
      supports: originals.map((_, i) => ({ referenceId: `reference:${i}` })),
      identity: [],
      limitation: "none",
    },
    usage: {},
  });
  expect(
    await assessResearchEvidence(request, originals, { name: "Artist" }, [], 5000),
  ).toMatchObject({ sufficient: false, failure: "invalid_evidence_selection", references: [] });
});
