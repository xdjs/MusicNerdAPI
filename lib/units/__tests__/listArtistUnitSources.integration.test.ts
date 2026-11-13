import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  },
}));
const { listArtistUnitSources } = await import("@/lib/units/listArtistUnitSources");

const artist = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

const vaultRevision = async (sourceId: string) =>
  (
    await client.query<{ r: string }>(
      `select coalesce(updated_at, created_at)::text || ':' || md5(coalesce(extracted_text, '')) || ':' || publication as r from artist_vault_sources where id=$1`,
      [sourceId],
    )
  ).rows[0].r;
const socialRevision = async (sourceId: string) =>
  (
    await client.query<{ r: string }>(
      `select 'fp:' || md5(to_jsonb(s)::text) as r from artist_social_posts s where id=$1`,
      [sourceId],
    )
  ).rows[0].r;
const unit = (
  kind: string,
  sourceId: string,
  revision: string,
  index: number,
  embedded = true,
  ingestVersion = 1,
) =>
  client.query(
    `insert into source_units(source_kind,source_id,artist_id,source_revision,unit_index,embedding,ingest_version) values($1,$2,$3,$4,$5,$6,$7)`,
    [kind, sourceId, artist, revision, index, embedded ? "[0.1]" : null, ingestVersion],
  );

beforeAll(async () => {
  await client.exec(`
    create table artist_vault_sources(id uuid,artist_id uuid,content_type text,extracted_text text,publication text not null default 'inherit',updated_at timestamptz,created_at timestamptz default '2026-01-02T00:00:00Z');
    create table artist_social_posts(id uuid,artist_id uuid,caption text,is_own_post boolean,raw jsonb);
    create table artist_research_candidates(id uuid,artist_id uuid,identity text,curation text,current_revision text);
    create table artist_research_evidence(id uuid,candidate_id uuid,artist_id uuid,revision text);
    create table source_units(source_kind text,source_id uuid,artist_id uuid,source_revision text,unit_index integer,embedding text,ingest_version integer not null);
    create function knowledge_social_post_snapshot(s artist_social_posts) returns jsonb language sql as 'select to_jsonb(s)';
    create function knowledge_source_fingerprint(j jsonb) returns text language sql as 'select ''fp:'' || md5(j::text)';
  `);
  const vault = (n: number, artistId: string, contentType: string | null, text: string | null) =>
    client.query(
      "insert into artist_vault_sources(id,artist_id,content_type,extracted_text) values($1,$2,$3,$4)",
      [id(n), artistId, contentType, text],
    );
  await vault(1, artist, "text/markdown", "indexed text");
  await vault(2, artist, "application/pdf", null);
  await vault(3, artist, "text/csv", null);
  await vault(4, artist, null, "web page text");
  await vault(5, artist, null, "two revisions");
  await vault(6, other, null, "another artist");
  await vault(7, artist, null, "indexed by an older ingest");
  const post = (n: number, own: boolean, raw: string) =>
    client.query(
      "insert into artist_social_posts(id,artist_id,caption,is_own_post,raw) values($1,$2,$3,$4,$5)",
      [id(n), artist, `caption ${n}`, own, raw],
    );
  await post(10, true, "{}");
  await post(11, true, '{"isRepost":true}');
  await post(12, true, '{"isRetweet":true}');
  await post(13, false, "{}");
  const candidate = (n: number, identity: string, curation: string, current: string) =>
    client.query("insert into artist_research_candidates values($1,$2,$3,$4,$5)", [
      id(n),
      artist,
      identity,
      curation,
      current,
    ]);
  await candidate(30, "confirmed", "approved", "rev-a");
  await candidate(31, "confirmed", "pending", "rev-new");
  await candidate(32, "unconfirmed", "approved", "rev-c");
  await candidate(33, "confirmed", "rejected", "rev-d");
  const evidence = (n: number, candidateId: number, revision: string) =>
    client.query("insert into artist_research_evidence values($1,$2,$3,$4)", [
      id(n),
      id(candidateId),
      artist,
      revision,
    ]);
  await evidence(20, 30, "rev-a");
  await evidence(21, 31, "rev-old");
  await evidence(22, 31, "rev-new");
  await evidence(23, 32, "rev-c");
  await evidence(24, 33, "rev-d");

  await unit("vault", id(1), await vaultRevision(id(1)), 0);
  await unit("vault", id(1), await vaultRevision(id(1)), 1);
  await unit("vault", id(4), "stale", 0);
  await unit("vault", id(4), "stale", 1, false);
  await unit("vault", id(7), await vaultRevision(id(7)), 0, true, 0);
  await unit("vault", id(5), "rev-x", 0);
  await unit("vault", id(5), "rev-y", 1);
  await unit("social", id(10), await socialRevision(id(10)), 0, false);
  await unit("evidence", id(20), "rev-a", 0);
  await unit("vault", id(99), "gone", 0);
  await unit("evidence", id(24), "rev-d", 0);
  await unit("evidence", id(98), "gone-e", 0);
  await unit("social", id(97), "gone-s", 0);
  await unit("social", id(11), "repost", 0);
}, 30000);
afterAll(async () => client.close());

describe("listArtistUnitSources", () => {
  it("lists every eligible source of the three kinds and every orphan, ordered by kind then id", async () => {
    const list = await listArtistUnitSources(artist);
    expect(list.map(e => [e.sourceKind, e.sourceId])).toEqual([
      ["evidence", id(20)],
      ["evidence", id(22)],
      ["evidence", id(98)],
      ["social", id(10)],
      ["social", id(97)],
      ["vault", id(1)],
      ["vault", id(2)],
      ["vault", id(4)],
      ["vault", id(5)],
      ["vault", id(7)],
      ["vault", id(99)],
    ]);
  });

  it("reports the indexed revision and missing embeddings from the source's units", async () => {
    const byId = new Map((await listArtistUnitSources(artist)).map(e => [e.sourceId, e]));
    expect(byId.get(id(1))).toEqual({
      sourceKind: "vault",
      sourceId: id(1),
      sourceRevision: await vaultRevision(id(1)),
      indexedRevision: await vaultRevision(id(1)),
      needsEmbedding: false,
    });
    expect(byId.get(id(2))).toEqual({
      sourceKind: "vault",
      sourceId: id(2),
      sourceRevision: await vaultRevision(id(2)),
      indexedRevision: null,
      needsEmbedding: false,
    });
    expect(byId.get(id(4))).toMatchObject({ indexedRevision: "stale", needsEmbedding: true });
    // Two revisions at once is never a current index.
    expect(byId.get(id(5))).toMatchObject({ indexedRevision: null, needsEmbedding: false });
    expect(byId.get(id(10))).toEqual({
      sourceKind: "social",
      sourceId: id(10),
      sourceRevision: await socialRevision(id(10)),
      indexedRevision: await socialRevision(id(10)),
      needsEmbedding: true,
    });
    expect(byId.get(id(20))).toEqual({
      sourceKind: "evidence",
      sourceId: id(20),
      sourceRevision: "rev-a",
      indexedRevision: "rev-a",
      needsEmbedding: false,
    });
    expect(byId.get(id(22))).toMatchObject({ sourceRevision: "rev-new", indexedRevision: null });
  });

  it("treats units written by an older ingest version as stale, so they are rebuilt", async () => {
    const byId = new Map((await listArtistUnitSources(artist)).map(e => [e.sourceId, e]));
    expect(byId.get(id(7))).toMatchObject({
      sourceRevision: await vaultRevision(id(7)),
      indexedRevision: null,
    });
  });

  it("flags units whose source row is gone as orphans, in each kind's table", async () => {
    const byId = new Map((await listArtistUnitSources(artist)).map(e => [e.sourceId, e]));
    expect(byId.get(id(99))).toEqual({
      sourceKind: "vault",
      sourceId: id(99),
      sourceRevision: null,
      indexedRevision: "gone",
      needsEmbedding: false,
    });
    expect(byId.get(id(98))).toMatchObject({ sourceKind: "evidence", sourceRevision: null });
    expect(byId.get(id(97))).toMatchObject({ sourceKind: "social", sourceRevision: null });
  });

  it("neither lists nor orphans the units of a row that exists but no longer counts", async () => {
    const ids = (await listArtistUnitSources(artist)).map(e => e.sourceId);
    // A rejected candidate's evidence and a repost keep their units: eligibility is checked at read time.
    expect(ids).not.toContain(id(24));
    expect(ids).not.toContain(id(11));
  });

  it("leaves out sources with nothing to index, other people's posts, and other artists", async () => {
    const ids = (await listArtistUnitSources(artist)).map(e => e.sourceId);
    for (const n of [3, 6, 11, 12, 13, 21, 23]) expect(ids).not.toContain(id(n));
    expect(await listArtistUnitSources(other)).toEqual([
      expect.objectContaining({ sourceKind: "vault", sourceId: id(6), indexedRevision: null }),
    ]);
  });
});
