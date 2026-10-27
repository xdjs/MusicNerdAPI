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
  expect(result.sources[0]).toEqual({
    sourceId: "vault:2",
    title: "label.example",
    url: "https://label.example/b",
    snippet: "Dutchyyy signed to Night Label in 2024.",
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
  expect(result).toEqual({ sources: [] });
});
