import { expect, it } from "vitest";
import { createPublicResearchTools } from "../createPublicResearchTools";
import type { ResearchOriginal, ResearchReference, ResearchRequest } from "../types";

const request: ResearchRequest = {
  topic: "Latest activities",
  evidenceNeed: "reporting",
  freshness: "stored",
  retrieval: "latest",
  answerScope: "overview",
};
const original = (
  id: string,
  url: string,
  text: string,
  publishedAt = "2026-10-07",
): ResearchOriginal => ({
  sourceId: id,
  revision: "r1",
  url,
  text,
  publishedAt,
  retrievedAt: null,
  curation: "approved",
  evidenceKind: "caption",
  speaker: "not_applicable",
  truncated: false,
});
const context = { toolCallId: "test", messages: [], context: {} };
const corpus = [
  ...Array.from({ length: 50 }, (_, i) =>
    original(`x:${i}`, `https://x.com/artist/status/${i}`, "Thanks!", "2026-10-12"),
  ),
  original(
    "moment:1",
    "https://inprocess.world/post/1",
    "By Design: I am sharing the studio recordings behind this project.",
  ),
  original("ig:1", "https://instagram.com/p/abc", "Project REACH is a new collaboration."),
];

it("makes quieter providers visible without discarding or hiding the busy account", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", []);
  const first = await s.tools.browseSources.execute!({ offset: 0 }, context);
  expect(first).toMatchObject({ total: 52, nextOffset: 12 });
  expect(JSON.stringify(first)).toContain("moment:1");
  expect(JSON.stringify(first)).toContain("ig:1");
  const x = await s.tools.browseSources.execute!({ offset: 36, provider: "x" }, context);
  expect(x).toMatchObject({ total: 50, nextOffset: 48 });
  expect(JSON.stringify(x)).toContain("x:");
});

it("lets a model search a new term and return only an actually read original", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", []);
  expect(s.tools.searchSources.description).toContain("body text of all eligible saved originals");
  expect(s.tools.searchSources.description).toContain("not publisher domains");
  expect(s.tools.searchSources.description).toContain("browseSources with a provider filter");
  const result = await s.tools.searchSources.execute!({ query: "studio recordings" }, context);
  expect(result).toMatchObject({ references: [expect.objectContaining({ sourceId: "moment:1" })] });
  await s.tools.finishEvidence.execute!({ referenceIds: ["read:0"] }, context);
  expect(s.outcome()).toMatchObject({
    sufficient: true,
    references: [expect.objectContaining({ sourceId: "moment:1" })],
  });
});

it("reserves two of twelve tool calls for finishing after ten exploration calls", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", []);
  await s.tools.readSources.execute!({ sources: [{ sourceId: "moment:1", start: 0 }] }, context);
  for (let i = 0; i < 9; i++) await s.tools.browseSources.execute!({ offset: 0 }, context);

  expect(await s.tools.searchSources.execute!({ query: "more" }, context)).toMatchObject({
    error: "exploration_tool_budget_exhausted",
    remainingToolCalls: 2,
    remainingExplorationCalls: 0,
    remainingCompletionCalls: 2,
  });
  expect(s.trace().toolCalls).toBe(10);
  expect(s.trace().readSourceIds).toEqual(["moment:1"]);

  expect(
    await s.tools.finishEvidence.execute!({ referenceIds: ["invented"] }, context),
  ).toMatchObject({
    error: "unread_reference",
    remainingToolCalls: 1,
    remainingExplorationCalls: 0,
    remainingCompletionCalls: 1,
  });
  expect(
    await s.tools.finishEvidence.execute!({ referenceIds: ["read:0"] }, context),
  ).toMatchObject({
    status: "complete",
  });
  expect(s.trace()).toMatchObject({
    toolCalls: 12,
    readSourceIds: ["moment:1"],
    stopReason: "supported",
  });
});

it("never reports more remaining exploration calls than the total call budget", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", []);
  for (let i = 0; i < 3; i++)
    await s.tools.finishEvidence.execute!({ referenceIds: [`invented:${i}`] }, context);

  expect(s.trace()).toMatchObject({
    toolCalls: 3,
    readChars: 0,
    calls: ["finish", "finish", "finish"],
    readSourceIds: [],
    rejectedIdCount: 3,
    stopReason: "incomplete",
  });
  expect(Object.keys(s.trace()).sort()).toEqual(
    [
      "eligibleSources",
      "toolCalls",
      "readChars",
      "calls",
      "readSourceIds",
      "rejectedIdCount",
      "stopReason",
    ].sort(),
  );
});

it("keeps repeated navigation searches compact and leaves budget for a later passage", async () => {
  const text =
    "Opening context. " +
    "Archive notes. ".repeat(600) +
    "Early sound and studio recording notes. " +
    "Long middle section. ".repeat(500) +
    "Later record production and sound change. " +
    "Closing context. ".repeat(200);
  const secondText =
    "Another source. " +
    "Early sound description. ".repeat(80) +
    "Other context. ".repeat(500) +
    "Later record production details. " +
    "Final notes. ".repeat(200);
  const sources = [
    original("long:one", "https://artist.example/one", text),
    original("long:two", "https://artist.example/two", secondText),
  ];
  const s = createPublicResearchTools(sources, request, "Artist", []);
  let returnedChars = 0;
  const firstSearch = (await s.tools.searchSources.execute!(
    { query: "early sound studio" },
    context,
  )) as {
    references: ResearchReference[];
    remainingReadChars: number;
  };
  expect(firstSearch.references.length).toBeGreaterThan(0);
  expect(firstSearch.references.every(reference => reference.text.length <= 1000)).toBe(true);
  expect(
    firstSearch.references.reduce((total, reference) => total + reference.text.length, 0),
  ).toBeLessThanOrEqual(4000);
  returnedChars += firstSearch.references.reduce(
    (total, reference) => total + reference.text.length,
    0,
  );
  expect(firstSearch.remainingReadChars).toBe(24000 - returnedChars);

  const readStarts = firstSearch.references.slice(0, 2).map(reference => ({
    sourceId: reference.sourceId,
    start: reference.end,
  }));
  const initialRead = (await s.tools.readSources.execute!({ sources: readStarts }, context)) as {
    references: ResearchReference[];
    remainingReadChars: number;
  };
  returnedChars += initialRead.references.reduce(
    (total, reference) => total + reference.text.length,
    0,
  );
  expect(initialRead.remainingReadChars).toBe(24000 - returnedChars);

  const repeatedSearch = (await s.tools.searchSources.execute!(
    { query: "early sound studio" },
    context,
  )) as {
    references: ResearchReference[];
    remainingReadChars: number;
  };
  returnedChars += repeatedSearch.references.reduce(
    (total, reference) => total + reference.text.length,
    0,
  );
  expect(repeatedSearch.remainingReadChars).toBe(24000 - returnedChars);

  const laterSearch = (await s.tools.searchSources.execute!(
    { query: "later record production" },
    context,
  )) as {
    references: ResearchReference[];
    remainingReadChars: number;
  };
  returnedChars += laterSearch.references.reduce(
    (total, reference) => total + reference.text.length,
    0,
  );
  expect(laterSearch.remainingReadChars).toBe(24000 - returnedChars);

  const laterStart = text.indexOf("Later record production and sound change.");
  const laterRead = (await s.tools.readSources.execute!(
    { sources: [{ sourceId: "long:one", start: laterStart }] },
    context,
  )) as { references: ResearchReference[]; remainingReadChars: number };
  expect(laterRead.references).toHaveLength(1);
  expect(laterRead.references[0].start).toBe(laterStart);
  expect(laterRead.references[0].text).toContain("Later record production and sound change.");
  expect(text.slice(laterRead.references[0].start, laterRead.references[0].end)).toBe(
    laterRead.references[0].text,
  );
  returnedChars += laterRead.references[0].text.length;
  expect(laterRead.remainingReadChars).toBe(24000 - returnedChars);
  expect(laterRead.remainingReadChars).toBeGreaterThan(0);
});

it("rejects invented and unread IDs, allowing a later valid selection", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", []);
  expect(
    await s.tools.finishEvidence.execute!({ referenceIds: ["moment:1"] }, context),
  ).toMatchObject({ error: "unread_reference" });
  expect(s.outcome()).toBeUndefined();
  await s.tools.readSources.execute!({ sources: [{ sourceId: "moment:1", start: 0 }] }, context);
  await s.tools.finishEvidence.execute!({ referenceIds: ["read:0"] }, context);
  expect(s.outcome()?.sufficient).toBe(true);
});

it("preserves original scope even when the model asks to broaden it", async () => {
  const s = createPublicResearchTools(
    corpus,
    { ...request, platform: "instagram", fromDate: "2026-10-07", toDate: "2026-10-08" },
    "Artist",
    [],
  );
  expect(s.inventory).toMatchObject({ eligibleSources: 1 });
  expect(
    await s.tools.readSources.execute!({ sources: [{ sourceId: "moment:1", start: 0 }] }, context),
  ).toMatchObject({ error: "source_unavailable" });
  expect(await s.tools.browseSources.execute!({ offset: 0, provider: "x" }, context)).toMatchObject(
    { total: 0 },
  );
  const speech = createPublicResearchTools(
    corpus,
    { ...request, evidenceNeed: "spoken_content" },
    "Artist",
    [],
  );
  expect(speech.inventory.eligibleSources).toBe(0);
});

it("opens later original context with exact offsets and enforces the aggregate text budget", async () => {
  const text = "a".repeat(28000) + "credit: another musician";
  const s = createPublicResearchTools(
    [original("long", "https://artist.example/story", text)],
    request,
    "Artist",
    [],
  );
  const late = await s.tools.readSources.execute!(
    { sources: [{ sourceId: "long", start: 28000 }] },
    context,
  );
  expect(late).toMatchObject({
    references: [
      expect.objectContaining({ start: 28000, end: text.length, text: "credit: another musician" }),
    ],
  });
  for (let i = 0; i < 6; i++)
    await s.tools.readSources.execute!(
      { sources: [{ sourceId: "long", start: i * 4000 }] },
      context,
    );
  expect(s.trace().readChars).toBeLessThanOrEqual(24000);
  expect(
    await s.tools.readSources.execute!({ sources: [{ sourceId: "long", start: 24000 }] }, context),
  ).toMatchObject({ error: "evidence_budget_exhausted" });
});

it("offers only server-approved external choices and cannot silently finish with no reason", async () => {
  const s = createPublicResearchTools([], request, "Artist", [
    {
      provider: "web",
      stage: "searching",
      query: "Artist news",
      reason: "work_specific_originals",
    },
  ]);
  expect(
    await s.tools.requestLookup.execute!({ provider: "x", reason: "missing_original" }, context),
  ).toMatchObject({ error: "lookup_unavailable" });
  expect(s.outcome()).toBeUndefined();
  await s.tools.requestLookup.execute!({ provider: "web", reason: "missing_original" }, context);
  expect(s.outcome()).toMatchObject({
    sufficient: false,
    nextLookup: "web",
    limitation: "missing_original",
  });
});

it("does not treat a browse page as sufficient inspection for a negative conclusion", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", []);
  await s.tools.browseSources.execute!({ offset: 0, provider: "not-present" }, context);
  expect(
    await s.tools.finishUnresolved.execute!({ reason: "missing_original" }, context),
  ).toMatchObject({ error: "read_saved_sources_first" });
  expect(s.outcome()).toBeUndefined();
});

it("keeps read partial support when another fact needs an outside lookup", async () => {
  const s = createPublicResearchTools(corpus, request, "Artist", [
    { provider: "web", stage: "searching", query: "Artist", reason: "work_specific_originals" },
  ]);
  await s.tools.readSources.execute!({ sources: [{ sourceId: "moment:1", start: 0 }] }, context);
  await s.tools.requestLookup.execute!(
    { provider: "web", reason: "missing_original", referenceIds: ["read:0"] },
    context,
  );
  expect(s.outcome()).toMatchObject({
    sufficient: false,
    references: [expect.objectContaining({ sourceId: "moment:1" })],
    nextLookup: "web",
  });
});

it.each(["read", "browse"])(
  "cannot report absence when %s exactly consumes the reading budget",
  async mode => {
    const s = createPublicResearchTools(
      [original("long", "https://artist.example/story", "a".repeat(30000))],
      request,
      "Artist",
      [{ provider: "web", stage: "searching", query: "Artist", reason: "work_specific_originals" }],
    );
    for (let i = 0; i < 6; i++)
      await s.tools.readSources.execute!(
        { sources: [{ sourceId: "long", start: i * 4000 }] },
        context,
      );
    if (mode === "browse") await s.tools.browseSources.execute!({ offset: 0 }, context);
    expect(s.trace().readChars).toBe(24000);
    expect(
      await s.tools.finishUnresolved.execute!({ reason: "missing_original" }, context),
    ).toMatchObject({ error: "evidence_budget_exhausted" });
    expect(
      await s.tools.requestLookup.execute!(
        { provider: "web", reason: "missing_original" },
        context,
      ),
    ).toMatchObject({ error: "evidence_budget_exhausted" });
    expect(s.outcome()).toBeUndefined();
    await s.tools.finishEvidence.execute!({ referenceIds: ["read:0"] }, context);
    expect(s.outcome()?.sufficient).toBe(true);
  },
);

it("cannot report absence after a browse truncates at the remaining text budget", async () => {
  const s = createPublicResearchTools(
    Array.from({ length: 12 }, (_, i) =>
      original(`long:${i}`, `https://artist.example/${i}`, "a".repeat(30000)),
    ),
    request,
    "Artist",
    [],
  );
  for (let i = 0; i < 5; i++)
    await s.tools.readSources.execute!(
      { sources: [{ sourceId: "long:0", start: i * 4000 }] },
      context,
    );
  await s.tools.browseSources.execute!({ offset: 0 }, context);
  await s.tools.browseSources.execute!({ offset: 0 }, context);
  expect(s.trace().readChars).toBe(24000);
  expect(
    await s.tools.finishUnresolved.execute!({ reason: "missing_original" }, context),
  ).toMatchObject({ error: "evidence_budget_exhausted" });
  expect(s.outcome()).toBeUndefined();
});
