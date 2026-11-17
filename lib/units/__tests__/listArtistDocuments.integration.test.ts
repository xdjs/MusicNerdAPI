import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import type { UnitSourceKind } from "@/lib/units/types";
import { UNIT_SEARCH_SCHEMA } from "./fixtures/unitSearchSchema";

const client = new PGlite();
const driver = drizzle(client);
const execute = vi.fn(
  async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
);
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { listArtistDocuments } = await import("@/lib/units/listArtistDocuments");

const artist = "00000000-0000-4000-8000-000000000001";
const otherArtist = "00000000-0000-4000-8000-000000000009";
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

async function currentRevision(kind: UnitSourceKind, sourceId: string) {
  const q =
    kind === "vault"
      ? sql`select ${vaultSourceRevisionSql("v")} as r from artist_vault_sources v where v.id = ${sourceId}::uuid`
      : kind === "social"
        ? sql`select ${socialPostRevisionSql("s")} as r from artist_social_posts s where s.id = ${sourceId}::uuid`
        : sql`select revision as r from artist_research_evidence where id = ${sourceId}::uuid`;
  return ((await driver.execute(q)).rows[0] as { r: string }).r;
}
async function addUnits(kind: UnitSourceKind, sourceId: string, count: number, revision?: string) {
  const r = revision ?? (await currentRevision(kind, sourceId));
  for (let i = 0; i < count; i++)
    await client.query(
      "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, text) values ($1, $2, $3, $4, $5, $6, 'text')",
      [kind, sourceId, artist, r, i, `p.${i + 1}`],
    );
}

beforeAll(async () => {
  await client.exec(UNIT_SEARCH_SCHEMA);
}, 30000);
afterAll(async () => client.close());
beforeEach(async () => {
  execute.mockClear();
  await client.exec(`
    delete from source_units; delete from artist_vault_sources; delete from artist_social_posts;
    delete from artist_research_candidates; delete from artist_research_evidence; delete from artist_claims;
    delete from artists;
  `);
  await client.query(
    `insert into artist_vault_sources(id, artist_id, status, publication, title, file_name, url, content_type, extracted_text) values
      ($1, $6, 'approved', 'public', 'Liner notes', 'liner.txt', 'https://example.com/liner', 'text/plain', 'body'),
      ($2, $6, 'approved', 'public', null, 'press.pdf', 'https://files.example/press.pdf', 'application/pdf', null),
      ($3, $6, 'approved', 'private', 'Diary', null, null, 'text/plain', 'secret'),
      ($4, $6, 'approved', 'public', 'Bare link', null, 'https://example.com/bare', null, null),
      ($5, $6, 'pending', 'public', 'Unreviewed', null, null, 'text/plain', 'draft'),
      ($7, $8, 'approved', 'public', 'Theirs', null, null, 'text/plain', 'other'),
      ($9, $6, 'approved', 'public', 'Blank', null, null, 'text/plain', '  ')`,
    [id(1), id(2), id(3), id(4), id(5), artist, id(6), otherArtist, id(7)],
  );
  await client.query(
    `insert into artist_social_posts(id, artist_id, platform, caption, url, is_own_post, raw) values
      ($1, $3, 'instagram', 'mine', 'https://instagram.com/p/1', true, '{}'),
      ($2, $3, 'instagram', 'repost', 'https://instagram.com/p/2', true, '{"isRepost":true}'),
      ($4, $3, 'instagram', ' ', 'https://instagram.com/p/4', true, '{}'),
      ($5, $3, 'instagram', null, 'https://instagram.com/p/5', true, $6)`,
    [
      id(10),
      id(11),
      artist,
      id(12),
      id(13),
      JSON.stringify({
        _musicnerdTranscript: {
          version: 1,
          actor: "apify/instagram-reel-scraper",
          text: "spoken words",
        },
      }),
    ],
  );
  await client.query(
    "insert into artist_research_candidates(id, artist_id, current_revision, identity, curation, url) values ($1, $3, 'r1', 'confirmed', 'approved', 'https://news.example/a'), ($2, $3, 'r1', 'unconfirmed', 'approved', 'https://news.example/b'), ($4, $3, 'r1', 'confirmed', 'approved', 'https://news.example/c')",
    [id(20), id(21), artist, id(22)],
  );
  await client.query(
    "insert into artist_research_evidence(id, candidate_id, artist_id, revision, title, original_text) values ($1, $2, $5, 'r1', 'Interview', 'q and a'), ($3, $4, $5, 'r1', 'Rumour', 'gossip'), ($6, $7, $5, 'r1', 'Empty page', '')",
    [id(30), id(20), id(31), id(21), artist, id(32), id(22)],
  );
});

describe("listArtistDocuments", () => {
  test("lists eligible sources with text, vault then evidence then social, with unit counts", async () => {
    await addUnits("vault", id(1), 3);
    await addUnits("social", id(10), 1);
    await addUnits("evidence", id(30), 2);
    await addUnits("social", id(11), 1);
    await addUnits("evidence", id(31), 1);
    await addUnits("vault", id(3), 1);
    expect(await listArtistDocuments(artist)).toEqual([
      {
        sourceKind: "vault",
        sourceId: id(1),
        title: "Liner notes",
        url: "https://example.com/liner",
        units: 3,
        indexing: false,
      },
      {
        sourceKind: "vault",
        sourceId: id(2),
        title: "press.pdf",
        url: "https://files.example/press.pdf",
        units: 0,
        indexing: true,
      },
      {
        sourceKind: "evidence",
        sourceId: id(30),
        title: "Interview",
        url: "https://news.example/a",
        units: 2,
        indexing: false,
      },
      {
        sourceKind: "social",
        sourceId: id(10),
        title: "Untitled",
        url: "https://instagram.com/p/1",
        units: 1,
        indexing: false,
      },
      {
        sourceKind: "social",
        sourceId: id(13),
        title: "Untitled",
        url: "https://instagram.com/p/5",
        units: 0,
        indexing: true,
      },
    ]);
  });

  test("leaves out an empty-caption post, an empty-text vault row and empty evidence", async () => {
    const ids = (await listArtistDocuments(artist)).map(d => d.sourceId);
    expect(ids).not.toContain(id(12));
    expect(ids).not.toContain(id(7));
    expect(ids).not.toContain(id(32));
  });

  test("caps the list at 60 documents, keeping vault and evidence first", async () => {
    for (let i = 0; i < 70; i++)
      await client.query(
        "insert into artist_social_posts(id, artist_id, platform, caption, is_own_post, raw) values ($1, $2, 'x', 'post', true, '{}')",
        [`00000000-0000-4000-8000-0000000002${String(i).padStart(2, "0")}`, artist],
      );
    const listed = await listArtistDocuments(artist);
    expect(listed).toHaveLength(60);
    expect(listed.slice(0, 3).map(d => d.sourceKind)).toEqual(["vault", "vault", "evidence"]);
  });

  test("listArtistDocuments marks an eligible source whose units are stale as indexing", async () => {
    await addUnits("vault", id(1), 3);
    await client.query("update artist_vault_sources set extracted_text = 'edited' where id = $1", [
      id(1),
    ]);
    const liner = (await listArtistDocuments(artist)).find(d => d.sourceId === id(1));
    expect(liner).toMatchObject({ units: 0, indexing: true });
  });

  test("drops a source once it stops being public", async () => {
    await addUnits("vault", id(1), 1);
    await client.query("update artist_vault_sources set publication = 'private' where id = $1", [
      id(1),
    ]);
    expect((await listArtistDocuments(artist)).map(d => d.sourceId)).not.toContain(id(1));
  });

  test("binds the artist id as a parameter", async () => {
    // Not a uuid, so Postgres refuses the cast; the query text is what matters.
    await expect(listArtistDocuments("x' or '1'='1")).rejects.toThrow();
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(q.params).toContain("x' or '1'='1");
    expect(q.sql).not.toContain("'1'='1");
  });
});
