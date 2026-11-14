import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { UNIT_SEARCH_SCHEMA } from "./fixtures/unitSearchSchema";

const client = new PGlite();
const driver = drizzle(client);
const execute = vi.fn(
  async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
);
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { searchUnitsByText } = await import("@/lib/units/searchUnitsByText");

const artist = "00000000-0000-4000-8000-000000000001";
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

async function addUnits(sourceId: string, texts: string[], title = "Liner notes") {
  const [{ r }] = (
    await client.query<{ r: string }>(
      "select coalesce(updated_at, created_at)::text || ':' || md5(coalesce(extracted_text, '')) || ':' || publication as r from artist_vault_sources where id = $1",
      [sourceId],
    )
  ).rows;
  for (const [i, text] of texts.entries())
    await client.query(
      "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, title, url, text) values ('vault', $1, $2, $3, $4, $5, $6, 'https://example.com/doc', $7)",
      [sourceId, artist, r, i, `p.${i + 1}`, title, text],
    );
}

beforeAll(async () => {
  await client.exec(UNIT_SEARCH_SCHEMA);
  await client.query(
    "insert into artist_vault_sources(id, artist_id, status, publication, extracted_text) values ($1, $2, 'approved', 'public', 'a'), ($3, $2, 'approved', 'private', 'b')",
    [id(1), artist, id(2)],
  );
}, 30000);
afterAll(async () => client.close());
beforeEach(async () => {
  execute.mockClear();
  await client.exec("delete from source_units");
});

describe("searchUnitsByText", () => {
  test("searchUnitsByText ranks the page containing the phrase first", async () => {
    await addUnits(id(1), [
      "The blue van broke down twice before the moon rose over the festival.",
      "They recorded Blue Moon in a barn outside the city.",
      "Nothing about that song here.",
    ]);
    await addUnits(id(2), ["They recorded Blue Moon in a barn, the private draft says."]);
    const hits = await searchUnitsByText(artist, "blue moon");
    expect(hits.map(h => [h.sourceId, h.unitIndex])).toEqual([
      [id(1), 1],
      [id(1), 0],
    ]);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[0]).toMatchObject({
      sourceKind: "vault",
      locator: "p.2",
      title: "Liner notes",
      url: "https://example.com/doc",
      text: "They recorded Blue Moon in a barn outside the city.",
    });
    expect(hits[0].sourceRevision).toMatch(/:public$/);
    expect(await searchUnitsByText(artist, '"blue moon"')).toHaveLength(1);
  });

  test("searchUnitsByText returns [] for stopwords without querying", async () => {
    await addUnits(id(1), ["the of"]);
    for (const query of ["the of", "", "   ", "The, OF!", "don't"])
      expect(await searchUnitsByText(artist, query)).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  test("guards an empty tsquery in SQL as well", async () => {
    await searchUnitsByText(artist, "barn");
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(q.sql).toContain("numnode(q) > 0");
    expect(q.params).toContain("barn");
  });

  test("matches the title and honours the limit", async () => {
    await addUnits(id(1), ["first page", "second page", "third page"], "Barn sessions");
    const hits = await searchUnitsByText(artist, "barn", 2);
    expect(hits.map(h => h.unitIndex)).toEqual([0, 1]);
  });

  test("or mode returns a page holding most but not all of the question's words", async () => {
    await addUnits(id(1), [
      "The band recorded their second album in a barn near Richmond.",
      "Nothing relevant on this page.",
    ]);
    const question = "Where did the band record their second album in Lisbon?";
    expect(await searchUnitsByText(artist, question)).toEqual([]);
    const hits = await searchUnitsByText(artist, question, undefined, "or");
    expect(hits.map(h => h.unitIndex)).toEqual([0]);
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits[0].score).toBeLessThan(1);
  });

  test("or mode binds an OR of distinct non-stopword terms, at most 24", async () => {
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`);
    await searchUnitsByText(artist, `The Barn's barn: "what" & | ! ${words.join(" ")}`, 5, "or");
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(q.sql).toContain("to_tsquery('english',");
    expect(q.sql).toContain("ts_rank_cd(u.search, q, 32)");
    expect(q.sql).toContain("numnode(q) > 0");
    const terms = q.params.find(p => typeof p === "string" && p.includes(" | ")) as string;
    expect(terms.split(" | ")).toEqual(["barn", ...words].slice(0, 24));
    expect(terms).toMatch(/^[\p{L}\p{N}]+( \| [\p{L}\p{N}]+)*$/u);
  });

  test("or mode returns [] for stopwords without querying", async () => {
    expect(await searchUnitsByText(artist, "what is the", undefined, "or")).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});
