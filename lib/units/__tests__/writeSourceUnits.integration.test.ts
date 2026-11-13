import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnitDraft } from "@/lib/units/types";

const client = new PGlite();
const driver = drizzle(client);
const store = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
};
vi.mock("@/lib/db/db", () => ({
  db: { execute: store.execute, transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(store) },
}));
const { writeSourceUnits } = await import("@/lib/units/writeSourceUnits");

const artistId = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const draft = (i: number, text = `unit ${i} text`): UnitDraft => ({
  unitIndex: i,
  locator: `p. ${i + 1}`,
  text,
  textHash: `hash${i}`,
  tokens: 4,
  ocr: false,
});
const input = (units: UnitDraft[], embeddings: number[][] | null = null) => ({
  sourceKind: "vault" as const,
  sourceId,
  artistId,
  sourceRevision: "rev1",
  title: "Doc",
  url: "https://example.com/doc",
  units,
  embeddings,
});
const rows = () =>
  store.execute(
    sql`select unit_index, search is not null as has_search, embedding, ingest_version from source_units where source_id = ${sourceId}::uuid order by unit_index`,
  ) as Promise<
    { unit_index: number; has_search: boolean; embedding: string | null; ingest_version: number }[]
  >;

beforeAll(async () => {
  await client.exec(`
    create schema extensions;
    create domain extensions.vector as text;
    create table artist_vault_sources(id uuid primary key);
    create table artist_social_posts(id uuid primary key);
    create table artist_research_evidence(id uuid primary key);
    create table source_units(
      id uuid primary key default gen_random_uuid(),
      source_kind text not null, source_id uuid not null, artist_id uuid not null,
      source_revision text not null, unit_index integer not null, locator text not null,
      title text, url text, text text not null, text_hash text not null, tokens integer not null,
      ocr boolean not null default false, ingest_version integer not null, embedding text,
      search tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || text)) stored,
      created_at timestamptz not null default now()
    );
  `);
});
beforeEach(async () => {
  await client.exec(`delete from source_units; delete from artist_vault_sources;`);
  await client.exec(`insert into artist_vault_sources(id) values ('${sourceId}')`);
});

describe("writeSourceUnits", () => {
  it("writes one row per unit with the generated search column", async () => {
    expect(await writeSourceUnits(store as never, input([draft(0), draft(1)]))).toBe(2);
    const r = await rows();
    expect(r).toHaveLength(2);
    expect(r.every(x => x.has_search && x.embedding === null && x.ingest_version === 1)).toBe(true);
  });
  it("replaces rows for the same source atomically", async () => {
    await writeSourceUnits(store as never, input([draft(0), draft(1), draft(2)]));
    expect(await writeSourceUnits(store as never, input([draft(0, "fresh")]))).toBe(1);
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0].unit_index).toBe(0);
  });
  it("stores embeddings as vector literals", async () => {
    await writeSourceUnits(store as never, input([draft(0)], [[0.1, 0.2]]));
    expect((await rows())[0].embedding).toBe("[0.1,0.2]");
  });
  it("batches inserts past 100 rows", async () => {
    const units = Array.from({ length: 205 }, (_, i) => draft(i));
    expect(await writeSourceUnits(store as never, input(units))).toBe(205);
    expect(await rows()).toHaveLength(205);
  });
  it("returns 0 and leaves no units when the source row is gone", async () => {
    await writeSourceUnits(store as never, input([draft(0)]));
    await client.exec(`delete from artist_vault_sources`);
    expect(await writeSourceUnits(store as never, input([draft(0), draft(1)]))).toBe(0);
    expect(await rows()).toHaveLength(0);
  });
});
