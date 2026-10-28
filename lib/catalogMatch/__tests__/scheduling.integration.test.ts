import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const id = "11111111-1111-4111-8111-111111111111";
const spotify = "A".repeat(22);
beforeAll(async () => {
  await db.exec(`CREATE ROLE mnweb; CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA musicnerd_private; GRANT USAGE ON SCHEMA musicnerd_private TO mnweb;
 CREATE TABLE artists(id uuid PRIMARY KEY,name text,spotify text,deezer text,bio text);
 CREATE TABLE artist_mapping_exclusions(artist_id uuid,platform text,reason text);
 CREATE TABLE musicnerd_private.catalog_link_disconnects(artist_id uuid,platform text);
 CREATE TABLE artist_research_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),artist_id uuid,kind text,status text DEFAULT 'pending',state jsonb DEFAULT '{}',attempts int DEFAULT 0,cursor int DEFAULT 0,total int,activity_id uuid,claimed_at timestamptz,last_error text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),CONSTRAINT artist_research_jobs_kind_check CHECK(kind IN ('spotify_match','source_search')));
 CREATE UNIQUE INDEX artist_research_jobs_one_live ON artist_research_jobs(artist_id,kind) WHERE status IN ('pending','running');
 GRANT SELECT,INSERT,UPDATE ON artists,artist_research_jobs TO mnweb;`);
  await db.exec(
    readFileSync(new URL("./fixtures/0059_catalog_counterpart_jobs.sql", import.meta.url), "utf8"),
  );
});
beforeEach(async () => {
  await db.exec(
    "RESET ROLE; TRUNCATE artists,artist_research_jobs,musicnerd_private.catalog_link_disconnects",
  );
});
afterAll(async () => {
  await db.close();
});
async function jobs() {
  return (
    await db.query<{ status: string; state: Record<string, unknown> }>(
      "SELECT status,state FROM artist_research_jobs ORDER BY created_at,id",
    )
  ).rows;
}
it("queues either creation direction once and does not replay unchanged edits or enrichment", async () => {
  await db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", spotify]);
  expect(await jobs()).toMatchObject([
    { status: "pending", state: { anchor: { spotify, deezer: null, name: "Artist" } } },
  ]);
  await db.exec(
    `UPDATE artists SET bio='enriched'; UPDATE artists SET spotify=spotify; SELECT musicnerd_private.queue_catalog_counterpart('${id}');`,
  );
  expect(await jobs()).toHaveLength(1);
  await db.exec("TRUNCATE artists,artist_research_jobs");
  await db.query("INSERT INTO artists VALUES($1,$2,NULL,$3,NULL)", [id, "Artist", "42"]);
  expect(await jobs()).toMatchObject([{ state: { anchor: { spotify: null, deezer: "42" } } }]);
});
it("invalidates a running lease on concurrent identity edits and cancels on completion without recursion", async () => {
  await db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", spotify]);
  await db.exec(
    "UPDATE artist_research_jobs SET status='running'; UPDATE artists SET spotify='BBBBBBBBBBBBBBBBBBBBBB'",
  );
  expect((await jobs()).filter(j => j.status === "pending")).toHaveLength(1);
  expect((await jobs()).filter(j => j.status === "done")[0].state.outcome).toBe("identity_changed");
  await db.exec("UPDATE artists SET deezer='42'");
  expect((await jobs()).every(j => j.status === "done")).toBe(true);
  expect(await jobs()).toHaveLength(2);
});
it("never schedules an archived user disconnect, invalid anchor, or complete pair", async () => {
  await db.query("INSERT INTO musicnerd_private.catalog_link_disconnects VALUES($1,$2)", [
    id,
    "deezer",
  ]);
  await db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", spotify]);
  expect(await jobs()).toHaveLength(0);
  await db.exec(
    "TRUNCATE artists,musicnerd_private.catalog_link_disconnects; ALTER TABLE artists DISABLE TRIGGER artists_validate_catalog_identity; INSERT INTO artists VALUES('11111111-1111-4111-8111-111111111111','Artist','invalid',NULL,NULL); ALTER TABLE artists ENABLE TRIGGER artists_validate_catalog_identity",
  );
  expect(await jobs()).toHaveLength(0);
  await db.exec("UPDATE artists SET spotify='AAAAAAAAAAAAAAAAAAAAAA',deezer='42'");
  expect(await jobs()).toHaveLength(0);
});
it("does not auto-backfill at installation; a bounded explicit enqueue can recover legacy rows", async () => {
  await db.exec(
    "ALTER TABLE artists DISABLE TRIGGER artists_catalog_counterpart; INSERT INTO artists VALUES('11111111-1111-4111-8111-111111111111','Artist','AAAAAAAAAAAAAAAAAAAAAA',NULL,NULL); ALTER TABLE artists ENABLE TRIGGER artists_catalog_counterpart",
  );
  expect(await jobs()).toHaveLength(0);
  await db.exec(
    `SET ROLE mnweb; SELECT musicnerd_private.queue_catalog_counterpart('${id}'); RESET ROLE`,
  );
  expect(await jobs()).toHaveLength(1);
  await db.exec(
    "UPDATE artist_research_jobs SET status='done',state=state || '{\"outcome\":\"not_found\"}'::jsonb; UPDATE artists SET bio='again'",
  );
  expect(await jobs()).toHaveLength(1);
});
it("revokes public enqueue permissions and uses a fixed definer search path", async () => {
  const result = await db.query(
    "SELECT has_function_privilege('anon','musicnerd_private.queue_catalog_counterpart(uuid)','EXECUTE') AS anon,has_function_privilege('authenticated','musicnerd_private.queue_catalog_counterpart(uuid)','EXECUTE') AS authenticated",
  );
  expect(result.rows).toEqual([{ anon: false, authenticated: false }]);
});

it("can return to a previously cancelled identity without replaying a completed search", async () => {
  await db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", spotify]);
  await db.exec(
    "UPDATE artists SET spotify='BBBBBBBBBBBBBBBBBBBBBB'; UPDATE artists SET spotify='AAAAAAAAAAAAAAAAAAAAAA'",
  );
  expect((await jobs()).filter(j => j.status === "pending")).toHaveLength(1);
  expect(await jobs()).toHaveLength(3);
});

it("tracks profiles with neither catalog and schedules verified recovery after an anchor is supplied", async () => {
  await db.query("INSERT INTO artists VALUES($1,$2,NULL,NULL,NULL)", [id, "Artist"]);
  expect(await jobs()).toMatchObject([
    { status: "pending", state: { anchor: { spotify: null, deezer: null } } },
  ]);
  await db.exec(
    "UPDATE artist_research_jobs SET status='done',state=state || '{\"outcome\":\"identity_anchor_required\"}'::jsonb; UPDATE artists SET deezer='42'",
  );
  expect((await jobs()).filter(j => j.status === "pending")).toMatchObject([
    { state: { anchor: { deezer: "42", spotify: null } } },
  ]);
});

it("rejects newly malformed or blank canonical IDs without rewriting legacy data", async () => {
  await expect(
    db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", "bad"]),
  ).rejects.toThrow("Invalid Spotify");
  await expect(
    db.query("INSERT INTO artists VALUES($1,$2,NULL,$3,NULL)", [id, "Artist", ""]),
  ).rejects.toThrow("Invalid Deezer");
  await db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", spotify]);
  await expect(db.exec("UPDATE artists SET deezer='not-a-deezer-id'")).rejects.toThrow(
    "Invalid Deezer",
  );
  expect(await jobs()).toHaveLength(1);
});

it("the application role can create an artist and activate only its scoped trigger job", async () => {
  await db.exec("SET ROLE mnweb");
  await db.query("INSERT INTO artists VALUES($1,$2,$3,NULL,NULL)", [id, "Artist", spotify]);
  expect(await jobs()).toMatchObject([
    { status: "pending", state: { anchor: { spotify, deezer: null } } },
  ]);
  await db.exec("RESET ROLE");
});
