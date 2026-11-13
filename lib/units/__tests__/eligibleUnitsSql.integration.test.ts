import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { eligibleUnitsSql } from "@/lib/units/eligibleUnitsSql";
import { socialPostRevisionSql } from "@/lib/sourcePublication/socialPostRevisionSql";
import { vaultSourceRevisionSql } from "@/lib/sourcePublication/vaultSourceRevisionSql";
import type { UnitSourceKind } from "@/lib/units/types";
import { UNIT_SEARCH_SCHEMA } from "./fixtures/unitSearchSchema";

const client = new PGlite();
const driver = drizzle(client);
const artist = "00000000-0000-4000-8000-000000000001";
const otherArtist = "00000000-0000-4000-8000-000000000009";
const id = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;

/** The revision the source row has right now, as ingest would stamp it. */
async function currentRevision(kind: UnitSourceKind, sourceId: string) {
  const q =
    kind === "vault"
      ? sql`select ${vaultSourceRevisionSql("v")} as r from artist_vault_sources v where v.id = ${sourceId}::uuid`
      : kind === "social"
        ? sql`select ${socialPostRevisionSql("s")} as r from artist_social_posts s where s.id = ${sourceId}::uuid`
        : sql`select revision as r from artist_research_evidence where id = ${sourceId}::uuid`;
  return ((await driver.execute(q)).rows[0] as { r: string }).r;
}
async function addUnit(kind: UnitSourceKind, sourceId: string, revision?: string, a = artist) {
  await client.query(
    "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, text) values ($1, $2, $3, $4, 0, 'p. 1', 'text')",
    [kind, sourceId, a, revision ?? (await currentRevision(kind, sourceId))],
  );
}
/** Re-stamps every unit with its source's current revision, so only publication decides. */
async function restamp() {
  const units = (
    await client.query<{ source_kind: UnitSourceKind; source_id: string }>(
      "select source_kind, source_id from source_units",
    )
  ).rows;
  for (const u of units)
    await client.query("update source_units set source_revision = $1 where source_id = $2", [
      await currentRevision(u.source_kind, u.source_id),
      u.source_id,
    ]);
}
const visible = async (alias?: string) =>
  (
    (
      await driver.execute(
        sql`select ${sql.raw(alias ?? "u")}.source_id::text as id from source_units ${sql.raw(alias ?? "u")} where ${eligibleUnitsSql(artist, alias)} order by 1`,
      )
    ).rows as { id: string }[]
  ).map(r => r.id);

beforeAll(async () => {
  await client.exec(UNIT_SEARCH_SCHEMA);
}, 30000);
afterAll(async () => client.close());
beforeEach(async () => {
  await client.exec(`
    delete from source_units; delete from artist_vault_sources; delete from artist_social_posts;
    delete from artist_research_candidates; delete from artist_research_evidence; delete from artist_claims;
    delete from artists;
  `);
  await client.query(
    "insert into artist_vault_sources(id, artist_id, status, publication, extracted_text) values ($1, $2, 'approved', 'public', 'body'), ($3, $2, 'approved', 'public', 'other')",
    [id(1), artist, id(2)],
  );
  await client.query(
    "insert into artist_social_posts(id, artist_id, caption, is_own_post, raw) values ($1, $2, 'mine', true, '{}'), ($3, $2, 'repost', true, '{\"isRepost\":true}'), ($4, $2, 'retweet', true, '{\"isRetweet\":true}'), ($5, $2, 'theirs', false, '{}')",
    [id(10), artist, id(11), id(12), id(13)],
  );
  await client.query(
    "insert into artist_research_candidates(id, artist_id, current_revision, identity, curation, url) values ($1, $2, 'r1', 'confirmed', 'approved', 'https://example.com/a'), ($3, $2, 'r1', 'unconfirmed', 'approved', 'https://example.com/b'), ($4, $2, 'r1', 'confirmed', 'rejected', 'https://example.com/c')",
    [id(20), artist, id(21), id(22)],
  );
  await client.query(
    "insert into artist_research_evidence(id, candidate_id, artist_id, revision) values ($1, $2, $3, 'r1'), ($4, $5, $3, 'r1'), ($6, $7, $3, 'r1')",
    [id(30), id(20), artist, id(31), id(21), id(32), id(22)],
  );
});

describe("eligibleUnitsSql", () => {
  test("eligibleUnitsSql hides a unit whose vault source is private", async () => {
    await addUnit("vault", id(1));
    await addUnit("vault", id(2));
    expect(await visible()).toEqual([id(1), id(2)]);
    await client.query("update artist_vault_sources set publication = 'private' where id = $1", [
      id(1),
    ]);
    await restamp();
    expect(await visible()).toEqual([id(2)]);
    await client.query(
      "update artist_vault_sources set publication = 'public', status = 'pending' where id = $1",
      [id(1)],
    );
    await restamp();
    expect(await visible()).toEqual([id(2)]);
    // Inherited publication counts once the artist has an approved claim.
    await client.query(
      "update artist_vault_sources set publication = 'inherit', status = 'approved' where id = $1",
      [id(1)],
    );
    await restamp();
    expect(await visible()).toEqual([id(2)]);
    await client.query("insert into artist_claims values ($1, 'approved')", [artist]);
    expect(await visible()).toEqual([id(1), id(2)]);
  });

  test("eligibleUnitsSql hides a unit whose source revision moved on", async () => {
    await addUnit("vault", id(1));
    await addUnit("social", id(10));
    await addUnit("evidence", id(30));
    expect(await visible()).toEqual([id(1), id(10), id(30)]);
    await client.query("update artist_vault_sources set extracted_text = 'edited' where id = $1", [
      id(1),
    ]);
    await client.query("update artist_social_posts set caption = 'edited' where id = $1", [id(10)]);
    await client.query("update artist_research_evidence set revision = 'r2' where id = $1", [
      id(30),
    ]);
    await client.query(
      "update artist_research_candidates set current_revision = 'r2' where id = $1",
      [id(20)],
    );
    expect(await visible()).toEqual([]);
    await restamp();
    expect(await visible()).toEqual([id(1), id(10), id(30)]);
  });

  test("shows only the artist's own original posts", async () => {
    for (const n of [10, 11, 12, 13]) await addUnit("social", id(n));
    expect(await visible()).toEqual([id(10)]);
  });

  test("shows only evidence the public research corpus would read", async () => {
    for (const n of [30, 31, 32]) await addUnit("evidence", id(n));
    expect(await visible()).toEqual([id(30)]);
    // Evidence that is no longer its candidate's current revision is hidden even if the unit matches it.
    await client.query(
      "update artist_research_candidates set current_revision = 'r2' where id = $1",
      [id(20)],
    );
    expect(await visible()).toEqual([]);
    await client.query(
      "update artist_research_candidates set current_revision = 'r1' where id = $1",
      [id(20)],
    );
    // A URL the artist made private in the vault hides the discovery too.
    await client.query(
      "insert into artist_vault_sources(id, artist_id, status, publication, url) values ($1, $2, 'approved', 'private', 'https://example.com/a')",
      [id(3), artist],
    );
    expect(await visible()).toEqual([]);
    await client.query("delete from artist_vault_sources where id = $1", [id(3)]);
    // A link destination must still be the artist's link.
    await client.query(
      "update artist_research_candidates set reviewed_revision = 'r1', destination = 'link', platform = 'instagram', platform_id = 'handle' where id = $1",
      [id(20)],
    );
    expect(await visible()).toEqual([]);
    await client.query("insert into artists(id, instagram) values ($1, 'handle')", [artist]);
    expect(await visible()).toEqual([id(30)]);
  });

  test("hides other artists' units, unknown kinds, and units of deleted rows", async () => {
    await addUnit("vault", id(1), undefined, otherArtist);
    await client.query(
      "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, text) values ('other', $1, $2, 'x', 0, 'p. 1', 't')",
      [id(1), artist],
    );
    await addUnit("vault", id(2));
    await client.query("delete from artist_vault_sources where id = $1", [id(2)]);
    expect(await visible()).toEqual([]);
  });

  test("uses the alias it is given", async () => {
    await addUnit("vault", id(1));
    expect(await visible("unit")).toEqual([id(1)]);
  });

  test("binds the artist id as a parameter", () => {
    const q = new PgDialect().sqlToQuery(eligibleUnitsSql("x' or '1'='1"));
    expect(q.params).toEqual(["x' or '1'='1"]);
    expect(q.sql).not.toContain("'1'='1");
  });
});
