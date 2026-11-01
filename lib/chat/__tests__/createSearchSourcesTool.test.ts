import { afterEach, expect, it, vi } from "vitest";
import { createSearchSourcesTool } from "@/lib/chat/createSearchSourcesTool";
import { originalFixture } from "./originalFixture";

type Found = { sources: { sourceId: string; snippet: string }[] };

const call = { toolCallId: "c", messages: [] } as never;
const originals = [
  originalFixture("vault:1", "https://www.news.example/a", "Dutchyyy toured Japan with a drummer."),
  originalFixture("vault:2", "https://label.example/b", "Dutchyyy signed to Night Label in 2024."),
  originalFixture("vault:3", "https://blog.example/c", "An interview about synthesizers."),
];

afterEach(() => vi.restoreAllMocks());

it("ranks stored sources for the query, then lists the rest, from stored text only", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const searchSources = createSearchSourcesTool(originals, "Dutchyyy");
  const result = (await searchSources.execute!({ query: "Night Label" }, call)) as Found;
  expect(result.sources[0]).toMatchObject({
    sourceId: "vault:2",
    title: "label.example",
    url: "https://label.example/b",
    snippet: "Dutchyyy signed to Night Label in 2024.",
    publishedAt: null,
    activityDate: null,
    retrievedAt: null,
  });
  expect(result.sources.map(s => s.sourceId).sort()).toEqual(["vault:1", "vault:2", "vault:3"]);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("returns at most 8 sources with bounded snippets", async () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    originalFixture(`vault:${i}`, `https://s${i}.example/`, `Source ${i} ${"x".repeat(600)}`),
  );
  const result = (await createSearchSourcesTool(many, "Dutchyyy").execute!(
    { query: "q" },
    call,
  )) as Found;
  expect(result.sources).toHaveLength(8);
  for (const source of result.sources) expect(source.snippet.length).toBeLessThanOrEqual(300);
});

it("returns no sources for an artist without stored sources", async () => {
  const result = await createSearchSourcesTool([], "Dutchyyy").execute!({ query: "q" }, call);
  expect(result).toMatchObject({ sources: [] });
});

it("snippets the passage that matches the query, not the page's start", async () => {
  const text = `${"Intro about the band. ".repeat(40)}Dutchyyy formed in Richmond in 1991.`;
  const searchSources = createSearchSourcesTool(
    [originalFixture("vault:1", "https://www.news.example/a", text)],
    "Dutchyyy",
  );
  const result = (await searchSources.execute!({ query: "formed Richmond" }, call)) as Found;
  expect(result.sources[0].snippet).toContain("formed in Richmond in 1991");
});

it("ranks distinct sources before the cap independently of incoming database order", async () => {
  const relevant = Array.from({ length: 6 }, (_, i) =>
    originalFixture(
      `vault:relevant-${i}`,
      `https://relevant.example/${i}`,
      `Session credits feature Mara Sol on synthesizer. ${"Background. ".repeat(i)}`,
    ),
  );
  const unrelated = Array.from({ length: 8 }, (_, i) =>
    originalFixture(
      `vault:unrelated-${i}`,
      `https://unrelated.example/${i}`,
      "Merchandise and concert parking information.",
    ),
  );
  const sources = [...unrelated, ...relevant];
  const query = { query: "Mara Sol synthesizer session credits" };
  const ids = async (rows: typeof sources) =>
    ((await createSearchSourcesTool(rows, "Artist").execute!(query, call)) as Found).sources.map(
      s => s.sourceId,
    );
  const forward = await ids(sources);
  expect(forward).toEqual(await ids([...sources].reverse()));
  for (const source of relevant) expect(forward).toContain(source.sourceId);
  expect(forward).toHaveLength(8);
});

it("preserves the scorer's short-term witness in the bounded discovery snippet", async () => {
  const { searchArtistKnowledge } = await import("@/lib/knowledge/searchArtistKnowledge");
  const { createResearchKnowledgeSnapshot } =
    await import("@/lib/questionResearch/createResearchKnowledgeSnapshot");
  const rows = [
    originalFixture(
      "vault:late",
      "https://example.com/late",
      "Background notes. ".repeat(300) + "Dub sessions supplied the recording context.",
    ),
  ];
  const ranked = searchArtistKnowledge(
    createResearchKnowledgeSnapshot(rows, "Artist"),
    { operation: "search", query: "dub", limit: 8, maxChars: 12800 },
    { maxPassagesPerSource: 1 },
  );
  expect(ranked.passages[0].start).toBeGreaterThan(0);
  expect(ranked.passages[0].text).toContain("Dub sessions");
  const discovered = (await createSearchSourcesTool(rows, "Artist").execute!(
    { query: "dub" },
    call,
  )) as Found;
  expect(discovered.sources[0].sourceId).toBe("vault:late");
  expect(discovered.sources[0].snippet).toContain("Dub sessions");
  expect(discovered.sources[0].snippet.length).toBeLessThanOrEqual(300);
  // Tests deterministic context transport, not autonomous source selection.
});

it("leaves latest/platform selection on its existing chronological path without locators", async () => {
  const rows = [
    {
      ...originalFixture("old", "https://instagram.com/p/old", "Older activity"),
      publishedAt: "2025-01-01",
    },
    {
      ...originalFixture("new", "https://instagram.com/p/new", "Newer activity"),
      publishedAt: "2026-01-01",
    },
    {
      ...originalFixture("other", "https://label.example/release", "Latest other platform"),
      publishedAt: "2026-02-01",
    },
  ];
  const result = (await createSearchSourcesTool(rows, "Artist").execute!(
    { query: "latest", retrieval: "latest", platform: "instagram" },
    call,
  )) as Found;
  expect(result.sources.map(s => s.sourceId)).toEqual(["new", "old"]);
  expect(result.sources.every(s => !("locator" in s))).toBe(true);
  expect(result.sources.every(s => s.snippet.length <= 300)).toBe(true);
});
