import { beforeEach, describe, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { SEARCH_CANDIDATES } from "@/lib/units/types";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { searchUnitsByVector } = await import("@/lib/units/searchUnitsByVector");

const artist = "00000000-0000-4000-8000-000000000001";
const rendered = () => new PgDialect().sqlToQuery(execute.mock.calls[0][0]);

beforeEach(() => execute.mockReset());

// PGlite has no pgvector; the operator itself runs against real Postgres in Task 21.
describe("searchUnitsByVector", () => {
  test("orders eligible embedded units by cosine distance to the bound vector", async () => {
    execute.mockResolvedValue([]);
    await searchUnitsByVector(artist, [0.25, -1], 5);
    const q = rendered();
    const distance = /u\.embedding operator\(extensions\.<=>\) \$(\d+)::extensions\.vector/g;
    const uses = [...q.sql.matchAll(distance)];
    expect(uses).toHaveLength(2);
    expect(q.sql).toContain("u.embedding is not null");
    expect(q.sql).toMatch(
      /order by u\.embedding operator\(extensions\.<=>\) \$\d+::extensions\.vector/,
    );
    expect(q.sql).toMatch(/1 - \(u\.embedding operator\(extensions\.<=>\)/);
    for (const [, n] of uses) expect(q.params[Number(n) - 1]).toBe("[0.25,-1]");
    expect(q.params).toContain(artist);
    expect(q.sql).toMatch(/limit \$(\d+)$/);
    expect(q.params[Number(q.sql.match(/limit \$(\d+)$/)![1]) - 1]).toBe(5);
    // The eligibility predicate guards every row.
    expect(q.sql).toContain("u.source_revision");
    expect(q.sql).toContain("artist_research_evidence");
  });

  test("defaults the limit to SEARCH_CANDIDATES and maps rows to hits", async () => {
    execute.mockResolvedValue([
      {
        source_kind: "social",
        source_id: "s1",
        source_revision: "fp:1",
        unit_index: 0,
        locator: "post",
        title: null,
        url: "https://instagram.com/p/1",
        text: "caption",
        score: 0.82,
      },
    ]);
    const hits = await searchUnitsByVector(artist, [1]);
    expect(rendered().params).toContain(SEARCH_CANDIDATES);
    expect(hits).toEqual([
      {
        sourceKind: "social",
        sourceId: "s1",
        sourceRevision: "fp:1",
        unitIndex: 0,
        locator: "post",
        title: null,
        url: "https://instagram.com/p/1",
        text: "caption",
        score: 0.82,
      },
    ]);
  });
});
