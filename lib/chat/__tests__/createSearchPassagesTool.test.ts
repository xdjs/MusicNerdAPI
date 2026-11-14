import { describe, expect, test, vi } from "vitest";
import { createChatDocuments } from "@/lib/chat/createChatDocuments";
import { createSearchPassagesTool } from "@/lib/chat/createSearchPassagesTool";
import { PASSAGE_CHARS, type UnitHit } from "@/lib/units/types";
import { unitHit } from "@/lib/units/__tests__/fixtures/unitHit";

type Output = {
  results: { n: number; locator: string; title: string; passage: string }[];
  weak: boolean;
  documents: {
    n: number;
    sourceKind: string;
    sourceId: string;
    revision: string;
    units: number;
    shown: number;
  }[];
};

const call = { toolCallId: "c", messages: [] } as never;

const setup = (
  hits: UnitHit[],
  weak = false,
  remainingTokens = 100_000,
  totals: Record<string, number> = {},
) => {
  let next = 0;
  const cite = vi.fn(() => ++next);
  const documents = createChatDocuments(cite);
  const search = vi.fn().mockResolvedValue({ hits, weak });
  // Every hit document has 10 units unless the test says otherwise.
  const count = vi.fn(
    async (_artist: string, refs: { sourceKind: string; sourceId: string }[]) =>
      new Map(
        refs.map(ref => {
          const key = `${ref.sourceKind}:${ref.sourceId}`;
          return [key, totals[key] ?? 10] as const;
        }),
      ),
  );
  const signal = new AbortController().signal;
  const budget = { remainingTokens };
  const tool = createSearchPassagesTool("artist-1", documents, {
    names: ["Dutchyyy"],
    signal,
    search,
    count,
    budget,
  });
  const run = async (query: string) => (await tool.execute!({ query }, call)) as Output;
  return { cite, documents, search, count, signal, run, budget };
};

describe("createSearchPassagesTool", () => {
  test("searchPassages registers each document once and returns passages with n", async () => {
    const social = { ...unitHit("b", 0, 1, "social"), title: null, url: null };
    const { cite, documents, search, signal, run } = setup([
      unitHit("a", 0),
      social,
      unitHit("a", 2),
    ]);
    const out = await run("tour dates");
    expect(search).toHaveBeenCalledWith("artist-1", "tour dates", {
      names: ["Dutchyyy"],
      signal,
    });
    expect(cite).toHaveBeenCalledTimes(2);
    expect(out).toEqual({
      results: [
        { n: 1, locator: "p.1", title: "Doc a", passage: "text a 0" },
        { n: 2, locator: "p.1", title: "Untitled", passage: "text b 0" },
        { n: 1, locator: "p.3", title: "Doc a", passage: "text a 2" },
      ],
      weak: false,
      truncated: false,
      documents: [
        {
          n: 1,
          sourceKind: "vault",
          sourceId: "a",
          revision: "rev",
          title: "Doc a",
          url: "https://example.com/a",
          units: 10,
          shown: 2,
        },
        {
          n: 2,
          sourceKind: "social",
          sourceId: "b",
          revision: "rev",
          title: "Untitled",
          url: null,
          units: 10,
          shown: 1,
        },
      ],
    });
    expect(documents.get(2)).toEqual({
      sourceKind: "social",
      sourceId: "b",
      revision: "rev",
      title: "Untitled",
      url: null,
    });
    // A second search finding the same document reuses its number and still reports it.
    const again = await run("tour");
    expect(cite).toHaveBeenCalledTimes(2);
    expect(again.documents.map(d => d.n)).toEqual([1, 2]);
  });

  test("counts every listed document's units in one call and reports how many were shown", async () => {
    const { run, count } = setup(
      [unitHit("a", 0), unitHit("b", 0), unitHit("a", 4), unitHit("a", 7)],
      false,
      100_000,
      { "vault:a": 13, "vault:b": 1 },
    );
    const out = await run("every alias");
    expect(count).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith("artist-1", [
      { sourceKind: "vault", sourceId: "a" },
      { sourceKind: "vault", sourceId: "b" },
    ]);
    expect(out.documents.map(d => [d.n, d.units, d.shown])).toEqual([
      [1, 13, 3],
      [2, 1, 1],
    ]);
  });

  test("falls back to the shown count for a document the count no longer finds", async () => {
    const { run, count } = setup([unitHit("a", 0), unitHit("a", 1)]);
    count.mockResolvedValueOnce(new Map());
    const out = await run("q");
    expect(out.documents.map(d => [d.units, d.shown])).toEqual([[2, 2]]);
  });

  test("counts nothing when nothing was returned", async () => {
    const { run, count } = setup([]);
    await run("q");
    expect(count).not.toHaveBeenCalled();
  });

  test("tells the model each document lists its units shown out of its total", () => {
    const { description } = createSearchPassagesTool("artist-1", createChatDocuments(vi.fn()), {
      names: [],
      budget: { remainingTokens: 1 },
    });
    expect(description).toMatch(/each document lists how many of its units were shown/i);
  });

  test("searchPassages reports weak results", async () => {
    const { run } = setup([], true);
    expect(await run("anything")).toEqual({
      results: [],
      weak: true,
      truncated: false,
      documents: [],
    });
  });

  test("windows a long passage around the first query term match", async () => {
    const text = `${"a".repeat(3000)} Night Label ${"b".repeat(3000)}`;
    const { run } = setup([{ ...unitHit("a", 0), text }]);
    const [{ passage }] = (await run("night label")).results;
    expect(passage).toHaveLength(PASSAGE_CHARS);
    expect(passage).toContain("Night Label");
    expect(text).toContain(passage);
  });

  test("keeps the window inside the text at either edge", async () => {
    const start = `Night ${"x".repeat(3000)}`;
    const end = `${"x".repeat(3000)} night`;
    const { run } = setup([
      { ...unitHit("a", 0), text: start },
      { ...unitHit("b", 0), text: end },
    ]);
    const [first, last] = (await run("NIGHT")).results;
    expect(first.passage).toBe(start.slice(0, PASSAGE_CHARS));
    expect(last.passage).toBe(end.slice(-PASSAGE_CHARS));
  });

  test("starts at the beginning when no query term appears, and keeps short text whole", async () => {
    const long = "y".repeat(5000);
    const { run } = setup([
      { ...unitHit("a", 0), text: long },
      { ...unitHit("b", 0), text: "short page" },
    ]);
    const [miss, short] = (await run("label")).results;
    expect(miss.passage).toBe(long.slice(0, PASSAGE_CHARS));
    expect(short.passage).toBe("short page");
  });
  test("teaches locators in the stored form, with no space after the marker", () => {
    const { description } = createSearchPassagesTool("artist-1", createChatDocuments(vi.fn()), {
      names: [],
      budget: { remainingTokens: 1 },
    });
    expect(description).toContain("`p.3`");
    expect(description).not.toMatch(/p\. \d/);
  });

  test("allows four searches per answer and refuses the fifth without searching", async () => {
    const { run, search } = setup([unitHit("a", 0)]);
    await Promise.all([run("a"), run("b"), run("c"), run("d")]);
    expect(await run("e")).toEqual({
      error: "Search limit reached for this answer",
      results: [],
      documents: [],
    });
    expect(search).toHaveBeenCalledTimes(4);
  });

  test("charges each returned passage to the shared budget", async () => {
    const { run, budget } = setup([
      { ...unitHit("a", 0), text: "x".repeat(400) },
      { ...unitHit("b", 0), text: "y".repeat(10) },
    ]);
    const out = await run("q");
    expect(out.results).toHaveLength(2);
    expect(budget.remainingTokens).toBe(100_000 - 100 - 3);
  });

  test("trims results to what the budget still holds, reports truncated, and numbers only what it returned", async () => {
    const { run, budget, cite } = setup(
      [
        { ...unitHit("a", 0), text: "x".repeat(400) },
        { ...unitHit("b", 0), text: "y".repeat(400) },
      ],
      false,
      150,
    );
    const out = await run("q");
    expect(out.results.map(r => r.n)).toEqual([1]);
    expect(out.documents.map(d => [d.n, d.shown])).toEqual([[1, 1]]);
    expect((out as Output & { truncated: boolean }).truncated).toBe(true);
    expect(budget.remainingTokens).toBe(50);
    expect(cite).toHaveBeenCalledTimes(1);
  });
});
