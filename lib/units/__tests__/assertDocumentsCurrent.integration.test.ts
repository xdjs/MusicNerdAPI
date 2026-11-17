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
const { assertDocumentsCurrent } = await import("@/lib/units/assertDocumentsCurrent");

const artist = "00000000-0000-4000-8000-000000000001";
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
const CHANGED = "Source changed or is no longer public";

beforeAll(async () => {
  await client.exec(UNIT_SEARCH_SCHEMA);
}, 30000);
afterAll(async () => client.close());
beforeEach(async () => {
  execute.mockClear();
  await client.exec(`
    delete from artist_vault_sources; delete from artist_social_posts;
    delete from artist_research_candidates; delete from artist_research_evidence;
  `);
  await client.query(
    "insert into artist_vault_sources(id, artist_id, status, publication, title, extracted_text) values ($1, $2, 'approved', 'public', 'Secret title', 'body')",
    [id(1), artist],
  );
  await client.query(
    "insert into artist_social_posts(id, artist_id, caption, is_own_post, raw) values ($1, $2, 'mine', true, '{}')",
    [id(10), artist],
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

describe("assertDocumentsCurrent", () => {
  test("passes when every vault, social and evidence ref is current, in one query", async () => {
    const refs = [
      await ref("vault", id(1)),
      await ref("social", id(10)),
      await ref("evidence", id(30)),
    ];
    await expect(assertDocumentsCurrent(artist, refs)).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test("throws, naming no text, when a vault source was withdrawn", async () => {
    const refs = [await ref("vault", id(1)), await ref("social", id(10))];
    await client.query("update artist_vault_sources set publication = 'private' where id = $1", [
      id(1),
    ]);
    const error = await assertDocumentsCurrent(artist, refs).catch(e => e);
    expect(error).toEqual(new Error(CHANGED));
    expect(String(error)).not.toContain("Secret");
  });

  test("throws when a revision changed: vault, social or evidence", async () => {
    const vault = await ref("vault", id(1));
    const social = await ref("social", id(10));
    const evidence = await ref("evidence", id(30));
    await client.query("update artist_vault_sources set extracted_text = 'edited' where id = $1", [
      id(1),
    ]);
    await expect(assertDocumentsCurrent(artist, [vault])).rejects.toThrow(CHANGED);
    await client.query("update artist_social_posts set caption = 'edited' where id = $1", [id(10)]);
    await expect(assertDocumentsCurrent(artist, [social])).rejects.toThrow(CHANGED);
    await expect(assertDocumentsCurrent(artist, [evidence])).resolves.toBeUndefined();
    await client.query("update artist_research_evidence set revision = 'r2' where id = $1", [
      id(30),
    ]);
    await client.query(
      "update artist_research_candidates set current_revision = 'r2' where id = $1",
      [id(20)],
    );
    await expect(assertDocumentsCurrent(artist, [evidence])).rejects.toThrow(CHANGED);
  });

  test("makes no query for no refs", async () => {
    await expect(assertDocumentsCurrent(artist, [])).resolves.toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });
});
