import { describe, expect, test, vi } from "vitest";
import { createChatDocuments } from "@/lib/chat/createChatDocuments";
import { createSearchPassagesTool } from "@/lib/chat/createSearchPassagesTool";
import {
  PASSAGE_CHARS,
  SHORT_DOCUMENT_CHARS,
  SHORT_DOCUMENT_UNITS,
  type UnitHit,
} from "@/lib/units/types";
import { unitHit } from "@/lib/units/__tests__/fixtures/unitHit";

type Output = {
  results: { n: number; locator: string; title: string; passage: string }[];
  weak: boolean;
  truncated: boolean;
  expanded: number | null;
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

type ReadUnits = typeof import("@/lib/units/readUnits").readUnits;

/** Every unit of document `doc` at revision `rev`, as `readUnits` returns them, each `chars` long. */
const wholeDocument = (doc: string, units: number, chars = 10) => ({
  revision: "rev",
  units: Array.from({ length: units }, (_, i) => ({
    locator: `p.${i + 1}`,
    text: `${doc}${i}`.padEnd(chars, "."),
    tokens: Math.ceil(chars / 4),
  })),
  missing: [],
});

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
  // A whole-document read finds nothing unless the test says otherwise, so nothing is expanded.
  const read = vi.fn<ReadUnits>().mockResolvedValue(null);
  const signal = new AbortController().signal;
  const budget = { remainingTokens };
  const tool = createSearchPassagesTool("artist-1", documents, {
    names: ["Dutchyyy"],
    signal,
    search,
    count,
    read,
    budget,
  });
  const run = async (query: string) => (await tool.execute!({ query }, call)) as Output;
  return { cite, documents, search, count, read, signal, run, budget };
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
      expanded: null,
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
      expanded: null,
      documents: [],
    });
  });

  test("windows a page longer than PASSAGE_CHARS around the query terms", async () => {
    const text = `${"a".repeat(4500)} Night Label ${"b".repeat(4500)}`;
    const { run } = setup([{ ...unitHit("a", 0), text }]);
    const [{ passage }] = (await run("night label")).results;
    expect(passage).toHaveLength(PASSAGE_CHARS);
    expect(passage).toContain("Night Label");
    expect(text).toContain(passage);
  });

  test("keeps the window inside the text at either edge", async () => {
    const start = `Night ${"x".repeat(9000)}`;
    const end = `${"x".repeat(9000)} night`;
    const { run } = setup([
      { ...unitHit("a", 0), text: start },
      { ...unitHit("b", 0), text: end },
    ]);
    const [first, last] = (await run("NIGHT")).results;
    expect(first.passage).toBe(start.slice(0, PASSAGE_CHARS));
    expect(last.passage).toBe(end.slice(-PASSAGE_CHARS));
  });

  test("returns a 5,957-character unit whole, whatever the query matches", async () => {
    const page = `${"a".repeat(2890)} Night Label ${"b".repeat(3054)}`;
    expect(page).toHaveLength(5957);
    const { run } = setup([{ ...unitHit("a", 0), text: page }]);
    const [{ passage }] = (await run("night label")).results;
    expect(passage).toBe(page);
  });

  test("starts at the beginning when no query term appears, and keeps short text whole", async () => {
    const long = "y".repeat(9000);
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
    expect(out.truncated).toBe(true);
    expect(budget.remainingTokens).toBe(50);
    expect(cite).toHaveBeenCalledTimes(1);
  });

  describe("a short document with several hits", () => {
    const thirteen = { "vault:a": 13, "vault:b": 13 };

    test("is returned whole after the ranked results, each unit once, in document order", async () => {
      const { run, read } = setup(
        [unitHit("a", 4), unitHit("b", 0), unitHit("a", 7)],
        false,
        100_000,
        thirteen,
      );
      read.mockResolvedValue(wholeDocument("a", 13));
      const out = await run("every alias");
      expect(read).toHaveBeenCalledOnce();
      expect(read).toHaveBeenCalledWith("artist-1", { sourceKind: "vault", sourceId: "a" }, []);
      expect(out.expanded).toBe(1);
      expect(out.results.slice(0, 3).map(r => [r.n, r.locator])).toEqual([
        [1, "p.5"],
        [2, "p.1"],
        [1, "p.8"],
      ]);
      const added = out.results.slice(3);
      expect(added.map(r => r.locator)).toEqual(
        [1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13].map(i => `p.${i}`),
      );
      expect(added.every(r => r.n === 1 && r.title === "Doc a")).toBe(true);
      expect(added[0].passage).toBe("a0".padEnd(10, "."));
      const locators = out.results.filter(r => r.n === 1).map(r => r.locator);
      expect(new Set(locators).size).toBe(13);
      expect(locators).toHaveLength(13);
      expect(out.documents.map(d => [d.n, d.units, d.shown])).toEqual([
        [1, 13, 13],
        [2, 13, 1],
      ]);
    });

    test("is charged to the shared read budget", async () => {
      const { run, read, budget } = setup(
        [unitHit("a", 0), unitHit("a", 1)],
        false,
        100_000,
        thirteen,
      );
      read.mockResolvedValue(wholeDocument("a", 13, 40));
      const out = await run("q");
      expect(out.expanded).toBe(1);
      // Two ranked hits of 8 characters (2 tokens each), then 11 units of 40 (10 tokens each).
      expect(budget.remainingTokens).toBe(100_000 - 2 * 2 - 11 * 10);
    });

    test("carries a windowed hit in full, charged to the limit and the budget", async () => {
      const big = "x".repeat(9000);
      const hit = { ...unitHit("a", 0), text: big };
      const { run, read, budget } = setup([hit, unitHit("a", 1)], false, 100_000, { "vault:a": 3 });
      read.mockResolvedValue({
        revision: "rev",
        units: [
          { locator: "p.1", text: big, tokens: 2250 },
          { locator: "p.2", text: "text a 1", tokens: 2 },
          { locator: "p.3", text: "third", tokens: 2 },
        ],
        missing: [],
      });
      const out = await run("q");
      expect(out.expanded).toBe(1);
      expect(out.results.find(r => r.locator === "p.1")!.passage).toHaveLength(9000);
      expect(out.results.filter(r => r.locator === "p.1")).toHaveLength(1);
      expect(out.results.map(r => r.locator)).toEqual(["p.1", "p.2", "p.3"]);
      // 9000 chars (2250 tokens) + 8 chars (2) for the hits, then 5 chars (2) for p.3.
      expect(budget.remainingTokens).toBe(100_000 - 2250 - 2 - 2);
    });

    test("is not expanded when carrying a windowed hit in full goes over the limit", async () => {
      const big = "x".repeat(24_000);
      const third = "y".repeat(15_000);
      const hit = { ...unitHit("a", 0), text: big };
      const { run, read, budget } = setup([hit, unitHit("a", 1)], false, 100_000, { "vault:a": 3 });
      read.mockResolvedValue({
        revision: "rev",
        units: [
          { locator: "p.1", text: big, tokens: 6000 },
          { locator: "p.2", text: "text a 1", tokens: 2 },
          { locator: "p.3", text: third, tokens: 3750 },
        ],
        missing: [],
      });
      const before = await run("q");
      expect(before.expanded).toBeNull();
      const windowed = before.results.find(r => r.locator === "p.1")!.passage;
      expect(windowed.length).toBeLessThan(24_000);
      expect(windowed).toHaveLength(PASSAGE_CHARS);
      expect(before.results).toHaveLength(2);
      expect(budget.remainingTokens).toBe(100_000 - Math.ceil(PASSAGE_CHARS / 4) - 2);
    });

    test("is not expanded on a single hit", async () => {
      const { run, read } = setup([unitHit("a", 0), unitHit("b", 0)], false, 100_000, thirteen);
      read.mockResolvedValue(wholeDocument("a", 13));
      const out = await run("q");
      expect(read).not.toHaveBeenCalled();
      expect(out.expanded).toBeNull();
      expect(out.results).toHaveLength(2);
    });

    test(`is not expanded past ${SHORT_DOCUMENT_UNITS} units`, async () => {
      const { run, read } = setup([unitHit("a", 0), unitHit("a", 1)], false, 100_000, {
        "vault:a": SHORT_DOCUMENT_UNITS + 1,
      });
      read.mockResolvedValue(wholeDocument("a", SHORT_DOCUMENT_UNITS + 1));
      const out = await run("q");
      expect(read).not.toHaveBeenCalled();
      expect(out.expanded).toBeNull();
    });

    test("is not expanded when every unit was already shown", async () => {
      const { run, read } = setup([unitHit("a", 0), unitHit("a", 1)], false, 100_000, {
        "vault:a": 2,
      });
      const out = await run("q");
      expect(read).not.toHaveBeenCalled();
      expect(out.expanded).toBeNull();
    });

    test("adds nothing when the rest of the document is over the character limit", async () => {
      const { run, read, budget } = setup(
        [unitHit("a", 0), unitHit("a", 1)],
        false,
        100_000,
        thirteen,
      );
      // 11 units not yet shown, together just over the limit.
      read.mockResolvedValue(wholeDocument("a", 13, Math.floor(SHORT_DOCUMENT_CHARS / 11) + 1));
      const out = await run("q");
      expect(out.expanded).toBeNull();
      expect(out.results).toHaveLength(2);
      expect(out.documents.map(d => [d.units, d.shown])).toEqual([[13, 2]]);
      expect(budget.remainingTokens).toBe(100_000 - 4);
    });

    test("adds nothing when the rest of the document does not fit the remaining budget", async () => {
      // 4 tokens for the two hits, then 11 units of 10 tokens need 110; 113 are left.
      const { run, read, budget } = setup([unitHit("a", 0), unitHit("a", 1)], false, 117, thirteen);
      read.mockResolvedValue(wholeDocument("a", 13, 40));
      const out = await run("q");
      expect(out.expanded).toBe(1);
      expect(budget.remainingTokens).toBe(3);

      const tight = setup([unitHit("a", 0), unitHit("a", 1)], false, 113, thirteen);
      tight.read.mockResolvedValue(wholeDocument("a", 13, 40));
      const refused = await tight.run("q");
      expect(refused.expanded).toBeNull();
      expect(refused.results).toHaveLength(2);
      expect(tight.budget.remainingTokens).toBe(109);
    });

    test("expands only the highest-ranked qualifying document", async () => {
      const { run, read } = setup(
        [unitHit("b", 0), unitHit("a", 0), unitHit("a", 1), unitHit("b", 1)],
        false,
        100_000,
        thirteen,
      );
      read.mockImplementation(async (_artist, ref) => wholeDocument(ref.sourceId, 13));
      const out = await run("q");
      expect(read).toHaveBeenCalledOnce();
      expect(read.mock.calls[0][1]).toEqual({ sourceKind: "vault", sourceId: "b" });
      expect(out.expanded).toBe(1);
      expect(out.documents.map(d => [d.sourceId, d.shown])).toEqual([
        ["b", 13],
        ["a", 2],
      ]);
    });

    test("skips a document that changed or left the index since the search", async () => {
      const changed = setup([unitHit("a", 0), unitHit("a", 1)], false, 100_000, thirteen);
      changed.read.mockResolvedValue({ ...wholeDocument("a", 13), revision: "later" });
      const out = await changed.run("q");
      expect(out.expanded).toBeNull();
      expect(out.results).toHaveLength(2);
      expect(changed.budget.remainingTokens).toBe(100_000 - 4);

      const gone = setup([unitHit("a", 0), unitHit("a", 1)], false, 100_000, thirteen);
      expect((await gone.run("q")).expanded).toBeNull();
    });

    test("tells the model a short document with several hits comes back whole", () => {
      const { description } = createSearchPassagesTool("artist-1", createChatDocuments(vi.fn()), {
        names: [],
        budget: { remainingTokens: 1 },
      });
      expect(description).toMatch(
        /when a short document has several hits, the whole document is included and `expanded` names it/i,
      );
    });
  });
});
