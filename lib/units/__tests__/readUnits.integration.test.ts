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
const { readUnits } = await import("@/lib/units/readUnits");

const artist = "00000000-0000-4000-8000-000000000001";
const otherArtist = "00000000-0000-4000-8000-000000000009";
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const vault = (sourceId: string) => ({ sourceKind: "vault" as const, sourceId });

async function revisionOf(sourceId: string) {
  return (
    await client.query<{ r: string }>(
      "select coalesce(updated_at, created_at)::text || ':' || md5(coalesce(extracted_text, '')) || ':' || publication as r from artist_vault_sources where id = $1",
      [sourceId],
    )
  ).rows[0].r;
}
async function addUnits(sourceId: string, count: number, revision?: string) {
  const r = revision ?? (await revisionOf(sourceId));
  for (let i = 0; i < count; i++)
    await client.query(
      "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, text, tokens) values ('vault', $1, $2, $3, $4, $5, $6, $7)",
      [sourceId, artist, r, i, `p. ${i + 1}`, `page ${i + 1} of ${sourceId}`, 100 + i],
    );
}

beforeAll(async () => {
  await client.exec(UNIT_SEARCH_SCHEMA);
}, 30000);
afterAll(async () => client.close());
beforeEach(async () => {
  execute.mockClear();
  await client.exec("delete from source_units; delete from artist_vault_sources;");
  await client.query(
    "insert into artist_vault_sources(id, artist_id, status, publication, extracted_text) values ($1, $3, 'approved', 'public', 'a'), ($2, $3, 'approved', 'public', 'b'), ($4, $5, 'approved', 'public', 'c')",
    [id(1), id(2), artist, id(3), otherArtist],
  );
});

describe("readUnits", () => {
  test("returns the requested units of one eligible source in unit order", async () => {
    await addUnits(id(1), 4);
    await addUnits(id(2), 2);
    const read = await readUnits(artist, vault(id(1)), ["p. 3", "p. 1", "p. 1", "p. 9"]);
    expect(read).toEqual({
      revision: await revisionOf(id(1)),
      units: [
        { locator: "p. 1", text: `page 1 of ${id(1)}`, tokens: 100 },
        { locator: "p. 3", text: `page 3 of ${id(1)}`, tokens: 102 },
      ],
      missing: ["p. 9"],
    });
  });

  test("reads every unit in order when no locators are given", async () => {
    await addUnits(id(1), 3);
    await addUnits(id(2), 2);
    const read = await readUnits(artist, vault(id(1)), []);
    expect(read).toEqual({
      revision: await revisionOf(id(1)),
      units: [1, 2, 3].map(page => ({
        locator: `p. ${page}`,
        text: `page ${page} of ${id(1)}`,
        tokens: 99 + page,
      })),
      missing: [],
    });
  });

  test("reports locators the current document lacks instead of returning null", async () => {
    await addUnits(id(1), 2);
    expect(await readUnits(artist, vault(id(1)), ["p. 7", "p. 8"])).toEqual({
      revision: await revisionOf(id(1)),
      units: [],
      missing: ["p. 7", "p. 8"],
    });
  });

  test("returns null for a source with no eligible units", async () => {
    expect(await readUnits(artist, vault(id(1)), [])).toBeNull();
    expect(await readUnits(artist, vault(id(1)), ["p. 1"])).toBeNull();
  });

  test("returns null once the source is no longer public", async () => {
    await addUnits(id(1), 2);
    await client.query("update artist_vault_sources set publication = 'private' where id = $1", [
      id(1),
    ]);
    // Even units re-stamped to the private revision stay hidden.
    await client.exec("delete from source_units");
    await addUnits(id(1), 2);
    expect(await readUnits(artist, vault(id(1)), ["p. 1"])).toBeNull();
  });

  test("hides stale units once the source revision moved on", async () => {
    await addUnits(id(1), 2);
    await client.query("update artist_vault_sources set extracted_text = 'edited' where id = $1", [
      id(1),
    ]);
    expect(await readUnits(artist, vault(id(1)), ["p. 1", "p. 2"])).toBeNull();
  });

  test("never reads another artist's source", async () => {
    await client.query(
      "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, text) values ('vault', $1, $2, $3, 0, 'p. 1', 'theirs')",
      [id(3), otherArtist, await revisionOf(id(3))],
    );
    expect(await readUnits(artist, vault(id(3)), ["p. 1"])).toBeNull();
  });

  test("binds the artist, source and locators as parameters", async () => {
    await addUnits(id(1), 1);
    expect(await readUnits(artist, vault(id(1)), ["p. 1' or '1'='1"])).toMatchObject({
      units: [],
      missing: ["p. 1' or '1'='1"],
    });
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(q.params).toEqual(expect.arrayContaining([artist, id(1), "p. 1' or '1'='1"]));
    expect(q.sql).not.toContain("'1'='1");
  });
});
