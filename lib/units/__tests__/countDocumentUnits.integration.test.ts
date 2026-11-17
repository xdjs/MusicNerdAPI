import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
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
const { countDocumentUnits } = await import("@/lib/units/countDocumentUnits");

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
async function addUnits(
  kind: UnitSourceKind,
  sourceId: string,
  count: number,
  opts: { revision?: string; from?: number } = {},
) {
  const r = opts.revision ?? (await currentRevision(kind, sourceId));
  const from = opts.from ?? 0;
  for (let i = from; i < from + count; i++)
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
    `insert into artist_vault_sources(id, artist_id, status, publication, title, content_type, extracted_text) values
      ($1, $4, 'approved', 'public', 'Bio', 'text/plain', 'body'),
      ($2, $4, 'approved', 'private', 'Diary', 'text/plain', 'secret'),
      ($3, $5, 'approved', 'public', 'Theirs', 'text/plain', 'other')`,
    [id(1), id(2), id(3), artist, otherArtist],
  );
  await client.query(
    "insert into artist_social_posts(id, artist_id, platform, caption, is_own_post, raw) values ($1, $2, 'instagram', 'mine', true, '{}')",
    [id(10), artist],
  );
  await client.query(
    "insert into artist_research_candidates(id, artist_id, current_revision, identity, curation, url) values ($1, $2, 'r1', 'confirmed', 'approved', 'https://news.example/a')",
    [id(20), artist],
  );
  await client.query(
    "insert into artist_research_evidence(id, candidate_id, artist_id, revision, title, original_text) values ($1, $2, $3, 'r1', 'Interview', 'q and a')",
    [id(30), id(20), artist],
  );
});

describe("countDocumentUnits", () => {
  test("counts each document's eligible, current units in one query, keyed kind:id", async () => {
    await addUnits("vault", id(1), 13);
    await addUnits("social", id(10), 1);
    await addUnits("evidence", id(30), 2);
    // Units cut from an older revision are not current and do not count.
    await addUnits("evidence", id(30), 4, { revision: "r0", from: 2 });
    const counts = await countDocumentUnits(artist, [
      { sourceKind: "vault", sourceId: id(1) },
      { sourceKind: "social", sourceId: id(10) },
      { sourceKind: "evidence", sourceId: id(30) },
    ]);
    expect(execute).toHaveBeenCalledOnce();
    expect(counts).toEqual(
      new Map([
        [`vault:${id(1)}`, 13],
        [`social:${id(10)}`, 1],
        [`evidence:${id(30)}`, 2],
      ]),
    );
  });

  test("leaves out documents a public read may not show and documents with no current units", async () => {
    await addUnits("vault", id(2), 3);
    await client.query(
      "insert into source_units(source_kind, source_id, artist_id, source_revision, unit_index, locator, text) values ('vault', $1, $2, 'x', 0, 'p.1', 'text')",
      [id(3), otherArtist],
    );
    const counts = await countDocumentUnits(artist, [
      { sourceKind: "vault", sourceId: id(2) },
      { sourceKind: "vault", sourceId: id(3) },
      { sourceKind: "vault", sourceId: id(1) },
      // A known id under the wrong kind matches nothing.
      { sourceKind: "social", sourceId: id(1) },
    ]);
    expect(counts).toEqual(new Map());
  });

  test("runs no query for no documents", async () => {
    expect(await countDocumentUnits(artist, [])).toEqual(new Map());
    expect(execute).not.toHaveBeenCalled();
  });
});
