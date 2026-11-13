/**
 * Opt-in: the vector half of unit search against real Postgres with pgvector (PGlite has none).
 *   docker run --rm -d -p 54329:5432 -e POSTGRES_PASSWORD=test --name mn-pgvector pgvector/pgvector:pg17
 *   MUSICNERD_UNITS_TEST_URL=postgres://postgres:test@127.0.0.1:54329/postgres pnpm vitest run searchUnitsByVector.postgres
 * Runs in CI against a pgvector service. The `source_units` DDL is read from the Web repo's migration
 * 0066 (`MUSICNERD_0066_SQL`); everything runs in a scratch database that is dropped afterwards.
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import { EMBEDDING_DIMENSIONS, type UnitDraft, type UnitSourceKind } from "@/lib/units/types";

const shared = vi.hoisted(() => ({ database: null as unknown }));
vi.mock("@/lib/db/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const database = shared.database as Record<PropertyKey, unknown>;
        const value = database[key];
        return typeof value === "function" ? value.bind(database) : value;
      },
    },
  ),
}));
const { searchUnitsByVector } = await import("@/lib/units/searchUnitsByVector");
const { writeSourceUnits } = await import("@/lib/units/writeSourceUnits");

const url = process.env.MUSICNERD_UNITS_TEST_URL;
const migrationPath =
  process.env.MUSICNERD_0066_SQL ??
  "/Users/peterarango/cursor experiments/MusicNerdMono/.worktrees/MusicNerdWeb/0066-source-units/drizzle/0066_source_units.sql";

/** The only `source_units` statements of 0066 the test needs: the table, its FK and its three indexes. */
function sourceUnitsDdl(): string[] {
  return readFileSync(migrationPath, "utf8")
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(
      s =>
        s.startsWith('CREATE TABLE "source_units"') ||
        s.startsWith('ALTER TABLE "source_units" ADD CONSTRAINT') ||
        s.startsWith('CREATE INDEX "source_units_'),
    );
}

const SCHEMA = `
  create schema extensions;
  create extension "uuid-ossp" with schema extensions;
  create extension vector with schema extensions;
  create table artists(id uuid primary key, instagram text);
  create table artist_claims(artist_id uuid, status text);
  create table artist_activity_events(id uuid, artist_id uuid, source_id uuid, actor_kind text, actor_user_id text, trigger text, action text);
  create table artist_vault_sources(
    id uuid primary key, artist_id uuid, activity_id uuid, origin text, status text,
    publication text not null default 'inherit', url text, file_path text, content_type text,
    extracted_text text, updated_at timestamptz, created_at timestamptz default '2026-01-02T00:00:00Z'
  );
  create table artist_social_posts(id uuid primary key, artist_id uuid, caption text, is_own_post boolean, raw jsonb);
  create table artist_research_candidates(
    id uuid primary key, artist_id uuid, current_revision text, identity text, curation text,
    reviewed_revision text, destination text, source_id uuid, platform text, platform_id text, url text
  );
  create table artist_research_evidence(id uuid primary key, candidate_id uuid, artist_id uuid, revision text);
  create function knowledge_social_post_snapshot(s artist_social_posts) returns jsonb language sql as 'select to_jsonb(s)';
  create function knowledge_source_fingerprint(j jsonb) returns text language sql as 'select ''fp:'' || md5(j::text)';
`;

/** A 1536-dim vector: mostly `axis` with a little of `tilt`, so distances are distinct and predictable. */
function vec(axis: number, tilt = 0, amount = 0): number[] {
  const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  v[axis] = 1;
  if (amount) v[tilt] = amount;
  return v;
}
const draft = (n: number): UnitDraft => ({
  unitIndex: 0,
  locator: `p. ${n}`,
  text: `unit ${n}`,
  textHash: `h${n}`,
  tokens: 3,
  ocr: false,
});

describe.skipIf(!url)("searchUnitsByVector on real Postgres with pgvector", () => {
  let admin: ReturnType<typeof postgres>;
  let client: ReturnType<typeof postgres>;
  let scratch = "";
  const artist = randomUUID();
  const otherArtist = randomUUID();

  beforeAll(async () => {
    const parsed = new URL(url as string);
    if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new Error(
        `MUSICNERD_UNITS_TEST_URL must point at localhost or 127.0.0.1, got ${parsed.hostname}; this test creates and drops a database.`,
      );
    }
    scratch = `units_vector_${process.pid}_${Date.now()}`;
    admin = postgres(url as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${scratch}`);
    parsed.pathname = `/${scratch}`;
    client = postgres(parsed.toString(), { prepare: false, max: 1, onnotice: () => {} });
    shared.database = drizzle(client);
    await client.unsafe(SCHEMA);
    for (const statement of sourceUnitsDdl()) await client.unsafe(statement);
  }, 60000);

  afterAll(async () => {
    await client?.end({ timeout: 5 });
    if (admin && scratch) await admin.unsafe(`drop database if exists ${scratch} with (force)`);
    await admin?.end({ timeout: 5 });
  }, 60000);

  beforeEach(async () => {
    await client.unsafe(`
      delete from source_units; delete from artist_vault_sources; delete from artist_social_posts;
      delete from artist_research_candidates; delete from artist_research_evidence;
      delete from artist_claims; delete from artists;
    `);
    await client`insert into artists(id) values (${artist}), (${otherArtist})`;
  });

  const database = () => shared.database as ReturnType<typeof drizzle>;
  const publicVault = async (id: string, a = artist, publication = "public") =>
    client`insert into artist_vault_sources(id, artist_id, status, publication, extracted_text) values (${id}, ${a}, 'approved', ${publication}, 'body')`;
  const revisionOf = async (id: string) =>
    (
      (await database().execute(
        sql`select ${vaultSourceRevisionSql("v")} as r from artist_vault_sources v where v.id = ${id}::uuid`,
      )) as unknown as { r: string }[]
    )[0].r;
  const writeVault = async (id: string, n: number, embedding: number[], a = artist) =>
    writeSourceUnits(database(), {
      sourceKind: "vault",
      sourceId: id,
      artistId: a,
      sourceRevision: await revisionOf(id),
      title: null,
      url: null,
      units: [draft(n)],
      embeddings: [embedding],
    });

  it("applies the 0066 source_units DDL with the vector extension and an HNSW cosine index", async () => {
    expect(sourceUnitsDdl()).toHaveLength(5);
    const [ext] =
      await client`select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'vector'`;
    expect(ext.nspname).toBe("extensions");
    const [index] =
      await client`select indexdef from pg_indexes where indexname = 'source_units_embedding'`;
    expect(index.indexdef).toMatch(/USING hnsw \(embedding extensions\.vector_cosine_ops\)/);
    const [column] =
      await client`select format_type(atttypid, atttypmod) as type from pg_attribute where attrelid = 'source_units'::regclass and attname = 'embedding'`;
    expect(column.type).toBe("extensions.vector(1536)");
  });

  it("writes a 1536-dim embedding through the vector cast and key-share locks all three kinds", async () => {
    const ids = { vault: randomUUID(), social: randomUUID(), evidence: randomUUID() };
    const candidate = randomUUID();
    await publicVault(ids.vault);
    await client`insert into artist_social_posts(id, artist_id, caption, is_own_post, raw) values (${ids.social}, ${artist}, 'c', true, '{}')`;
    await client`insert into artist_research_evidence(id, candidate_id, artist_id, revision) values (${ids.evidence}, ${candidate}, ${artist}, 'r1')`;
    const kinds: UnitSourceKind[] = ["vault", "social", "evidence"];
    for (const [n, kind] of kinds.entries()) {
      const written = await writeSourceUnits(database(), {
        sourceKind: kind,
        sourceId: ids[kind],
        artistId: artist,
        sourceRevision: "rev",
        title: null,
        url: null,
        units: [draft(n)],
        embeddings: [vec(n)],
      });
      expect(written).toBe(1);
    }
    const rows =
      await client`select source_kind, extensions.vector_dims(embedding) as dims from source_units order by source_kind`;
    expect(rows.map(r => [r.source_kind, Number(r.dims)])).toEqual([
      ["evidence", EMBEDDING_DIMENSIONS],
      ["social", EMBEDDING_DIMENSIONS],
      ["vault", EMBEDDING_DIMENSIONS],
    ]);
    // A source that no longer exists is locked out: nothing is written.
    const gone = await writeSourceUnits(database(), {
      sourceKind: "vault",
      sourceId: randomUUID(),
      artistId: artist,
      sourceRevision: "rev",
      title: null,
      url: null,
      units: [draft(9)],
      embeddings: [vec(9)],
    });
    expect(gone).toBe(0);
  });

  it("returns the nearest eligible unit first, scored 1 - cosine distance", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) await publicVault(id);
    await writeVault(ids[0], 0, vec(0));
    await writeVault(ids[1], 1, vec(1, 2, 0.2));
    await writeVault(ids[2], 2, vec(2));
    const hits = await searchUnitsByVector(artist, vec(1));
    expect(hits[0].sourceId).toBe(ids[1]);
    expect(hits).toHaveLength(3);
    // cos(vec(1), vec(1)+0.2*e2) = 1 / sqrt(1.04)
    expect(hits[0].score).toBeCloseTo(1 - (1 - 1 / Math.sqrt(1.04)), 5);
    expect(hits[1].score).toBeCloseTo(0, 5);
  });

  it("hides a unit at a stale revision and a unit of a private vault source", async () => {
    const [fresh, stale, hidden] = [randomUUID(), randomUUID(), randomUUID()];
    await publicVault(fresh);
    await publicVault(stale);
    await publicVault(hidden, artist, "private");
    await writeVault(fresh, 0, vec(0));
    await writeVault(stale, 1, vec(0, 1, 0.1));
    await writeVault(hidden, 2, vec(0, 2, 0.1));
    const ids = async () => (await searchUnitsByVector(artist, vec(0))).map(h => h.sourceId);
    // The private source's unit is hidden at once; the other two are current.
    expect(await ids()).toEqual([fresh, stale]);
    await client`update artist_vault_sources set extracted_text = 'edited' where id = ${stale}`;
    expect(await ids()).toEqual([fresh]);
    // Publishing the private source moves its revision on, so its old unit stays hidden until re-ingest.
    await client`update artist_vault_sources set publication = 'public' where id = ${hidden}`;
    expect(await ids()).toEqual([fresh]);
  });

  it("returns every eligible unit of a small artist when the planner scans the HNSW index", async () => {
    const own = [randomUUID(), randomUUID(), randomUUID()];
    for (const [n, id] of own.entries()) {
      await publicVault(id);
      await writeVault(id, n, vec(500 + n));
    }
    // Other artists' units sit nearer the query, so an HNSW scan post-filtered to this artist runs
    // out of candidates before it reaches the artist's own rows.
    for (let n = 0; n < 300; n++) {
      const id = randomUUID();
      await publicVault(id, otherArtist);
      await writeVault(id, 100 + n, vec(n % 100, 101 + (n % 7), 0.01), otherArtist);
    }
    await client`analyze source_units`;
    // Make the HNSW index the only way to order by distance, as it can be for a larger artist.
    await client`drop index source_units_artist`;
    await client`set enable_seqscan = off`;
    await client`set enable_sort = off`;
    try {
      const plan =
        await client`explain select id from source_units where artist_id = ${artist} order by embedding operator(extensions.<=>) ${JSON.stringify(vec(1))}::extensions.vector limit 20`;
      expect(plan.map(r => r["QUERY PLAN"]).join("\n")).toContain("source_units_embedding");
      const hits = await searchUnitsByVector(artist, vec(1));
      expect(hits.map(h => h.sourceId).sort()).toEqual([...own].sort());
    } finally {
      await client`reset enable_seqscan`;
      await client`reset enable_sort`;
      await client`create index source_units_artist on source_units using btree (artist_id, source_kind, source_id)`;
    }
  });

  it("returns [{ revision }] from the OCR-fill update shape through the real driver", async () => {
    const id = randomUUID();
    await client`insert into artist_vault_sources(id, artist_id, status, publication) values (${id}, ${artist}, 'approved', 'public')`;
    const before = await revisionOf(id);
    const rows = await database().execute<{ revision: string }>(
      sql`update artist_vault_sources v set extracted_text = ${"filled"} where v.id = ${id}::uuid and v.extracted_text is null returning ${vaultSourceRevisionSql()} as revision`,
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).toEqual(["revision"]);
    expect(rows[0].revision).toBe(await revisionOf(id));
    expect(rows[0].revision).not.toBe(before);
    const again = await database().execute<{ revision: string }>(
      sql`update artist_vault_sources v set extracted_text = ${"again"} where v.id = ${id}::uuid and v.extracted_text is null returning ${vaultSourceRevisionSql()} as revision`,
    );
    expect(again).toHaveLength(0);
  });
});
