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
const { findCurrentDocuments } = await import("@/lib/units/findCurrentDocuments");

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
const ref = async (sourceKind: UnitSourceKind, sourceId: string) => ({
  sourceKind,
  sourceId,
  revision: await currentRevision(sourceKind, sourceId),
});
const key = (r: { sourceKind: string; sourceId: string; revision: string }) =>
  `${r.sourceKind}:${r.sourceId}:${r.revision}`;

beforeAll(async () => {
  await client.exec(UNIT_SEARCH_SCHEMA);
}, 30000);
afterAll(async () => client.close());
beforeEach(async () => {
  execute.mockClear();
  await client.exec(`
    delete from artist_vault_sources; delete from artist_social_posts;
    delete from artist_research_candidates; delete from artist_research_evidence; delete from artist_claims;
  `);
  await client.query(
    "insert into artist_vault_sources(id, artist_id, status, publication, extracted_text) values ($1, $2, 'approved', 'public', 'body'), ($3, $4, 'approved', 'public', 'theirs')",
    [id(1), artist, id(2), otherArtist],
  );
  await client.query(
    "insert into artist_social_posts(id, artist_id, caption, is_own_post, raw) values ($1, $2, 'mine', true, '{}'), ($3, $2, 'repost', true, '{\"isRepost\":true}')",
    [id(10), artist, id(11)],
  );
  await client.query(
    "insert into artist_research_candidates(id, artist_id, current_revision, identity, curation, url) values ($1, $2, 'r1', 'confirmed', 'approved', 'https://example.com/a')",
    [id(20), artist],
  );
  await client.query(
    "insert into artist_research_evidence(id, candidate_id, artist_id, revision) values ($1, $2, $3, 'r1')",
    [id(30), id(20), artist],
  );
});

describe("findCurrentDocuments", () => {
  test("returns every ref still public at its revision, in one query", async () => {
    const refs = [
      await ref("vault", id(1)),
      await ref("social", id(10)),
      await ref("evidence", id(30)),
    ];
    expect(await findCurrentDocuments(artist, refs)).toEqual(new Set(refs.map(key)));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test("leaves out withdrawn, changed, ineligible, deleted and other artists' sources", async () => {
    const vault = await ref("vault", id(1));
    const social = await ref("social", id(10));
    const evidence = await ref("evidence", id(30));
    const refs = [
      vault,
      social,
      evidence,
      await ref("social", id(11)),
      await ref("vault", id(2)),
      { sourceKind: "vault" as const, sourceId: id(99), revision: "x" },
    ];
    expect(await findCurrentDocuments(artist, refs)).toEqual(
      new Set([vault, social, evidence].map(key)),
    );
    await client.query("update artist_vault_sources set publication = 'private' where id = $1", [
      id(1),
    ]);
    await client.query("update artist_social_posts set caption = 'edited' where id = $1", [id(10)]);
    await client.query(
      "update artist_research_candidates set current_revision = 'r2' where id = $1",
      [id(20)],
    );
    expect(await findCurrentDocuments(artist, refs)).toEqual(new Set());
  });

  test("tells apart two revisions of one document", async () => {
    const vault = await ref("vault", id(1));
    const stale = { ...vault, revision: "stale" };
    expect(await findCurrentDocuments(artist, [stale, vault])).toEqual(new Set([key(vault)]));
  });

  test("makes no query for no refs", async () => {
    expect(await findCurrentDocuments(artist, [])).toEqual(new Set());
    expect(execute).not.toHaveBeenCalled();
  });

  test("binds the artist and every ref as parameters", async () => {
    await findCurrentDocuments("x' or '1'='1", [
      { sourceKind: "vault", sourceId: id(1), revision: "r' or '1'='1" },
    ]).catch(() => undefined);
    const q = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(q.params).toEqual(expect.arrayContaining(["x' or '1'='1", id(1), "r' or '1'='1"]));
    expect(q.sql).not.toContain("'1'='1");
  });
});
