import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";
import manifest from "./fixtures/migrations/manifest.json";
const db = new PGlite();
const a = "00000000-0000-4000-8000-000000000001";
const u = "00000000-0000-4000-8000-000000000002";
const v = "00000000-0000-4000-8000-000000000003";
const receipt = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  // Explicit synthetic prerequisites; these grants are not migration evidence.
  await db.exec(`CREATE ROLE mnweb;CREATE ROLE anon;CREATE ROLE authenticated;
  CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE SQL AS 'SELECT gen_random_uuid()';
  CREATE TABLE users(id uuid PRIMARY KEY,privy_user_id text);
  CREATE TABLE artists(id uuid PRIMARY KEY);
  GRANT SELECT ON users,artists TO mnweb;`);
  for (const [name, hash] of Object.entries(manifest.sha256)) {
    const sql = readFileSync(new URL(`./fixtures/migrations/${name}`, import.meta.url), "utf8");
    expect(createHash("sha256").update(sql).digest("hex")).toBe(hash);
    await db.exec(sql);
  }
  await db.exec(
    "GRANT SELECT,INSERT,UPDATE,DELETE ON artist_claims,artist_vault_sources,artist_bio_versions TO mnweb",
  );
}, 30000);
beforeEach(async () => {
  await db.exec(`RESET ROLE;TRUNCATE users,artists CASCADE;
  INSERT INTO users VALUES('${u}',NULL),('${v}','fixture-privy');INSERT INTO artists VALUES('${a}');SET ROLE mnweb;
  INSERT INTO artist_activity_events(id,artist_id,actor_user_id,actor_kind,action,trigger) VALUES('${receipt}','${a}','${u}','user','source_search','editor_search');`);
});
afterAll(async () => {
  await db.close();
});
it("retains append-only receipts after source and job deletion", async () => {
  await db.exec(`INSERT INTO artist_vault_sources(artist_id,url,activity_id) VALUES('${a}','https://example.test/source','${receipt}');
  INSERT INTO artist_research_jobs(artist_id,kind,activity_id) VALUES('${a}','source_search','${receipt}');
  DELETE FROM artist_vault_sources;DELETE FROM artist_research_jobs;`);
  expect((await db.query("SELECT id FROM artist_activity_events")).rows).toEqual([{ id: receipt }]);
  await expect(db.exec("UPDATE artist_activity_events SET action='changed'")).rejects.toThrow(
    /permission denied/,
  );
  await expect(db.exec("DELETE FROM artist_activity_events")).rejects.toThrow(/permission denied/);
});
it.each(["anon", "authenticated"])(
  "denies browser role %s receipts and vault access",
  async role => {
    await db.exec(`RESET ROLE;SET ROLE ${role}`);
    await expect(db.exec("SELECT * FROM artist_activity_events")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.exec("SELECT * FROM artist_vault_sources")).rejects.toThrow(
      /permission denied/,
    );
  },
);
it("enforces source foreign keys and per-artist URL uniqueness", async () => {
  await db.exec(
    `INSERT INTO artist_vault_sources(artist_id,url) VALUES('${a}','https://example.test/source')`,
  );
  await expect(
    db.exec(
      `INSERT INTO artist_vault_sources(artist_id,url) VALUES('${a}','https://example.test/source')`,
    ),
  ).rejects.toThrow(/unique constraint/);
  await expect(
    db.exec(
      `INSERT INTO artist_vault_sources(artist_id,url) VALUES('${v}','https://example.test/other')`,
    ),
  ).rejects.toThrow(/foreign key/);
});
it("allows only attribution reassignment on self-edits, preserving audit content", async () => {
  await db.exec(
    `INSERT INTO artist_self_edits(artist_id,user_id,site_name,new_value,submitted_url) VALUES('${a}','${u}','deezer','123','https://deezer.com/artist/123');UPDATE artist_self_edits SET user_id='${v}'`,
  );
  await expect(db.exec("UPDATE artist_self_edits SET new_value='456'")).rejects.toThrow(
    /permission denied/,
  );
  await expect(db.exec("DELETE FROM artist_self_edits")).rejects.toThrow(/permission denied/);
});
it("preserves receipt UUIDs through the guarded account transfer function", async () => {
  await expect(
    db.exec(`SELECT transfer_account_activity('${u}','${v}','wrong')`),
  ).rejects.toThrow();
  await db.exec(`SELECT transfer_account_activity('${u}','${v}','fixture-privy')`);
  expect((await db.query("SELECT id,actor_user_id FROM artist_activity_events")).rows).toEqual([
    { id: receipt, actor_user_id: v },
  ]);
});
it("permits queued extraction only with versioned source identity and prevents duplicate live jobs", async () => {
  await expect(
    db.exec(
      `INSERT INTO artist_research_jobs(artist_id,kind,status) VALUES('${a}','source_extract','queued')`,
    ),
  ).rejects.toThrow(/check constraint/);
  await db.exec(
    `INSERT INTO artist_research_jobs(artist_id,kind,status,state) VALUES('${a}','source_extract','queued','{"version":2,"autoSourceId":"fixture-source"}')`,
  );
  await expect(
    db.exec(
      `INSERT INTO artist_research_jobs(artist_id,kind,status,state) VALUES('${a}','source_extract','queued','{"version":2,"autoSourceId":"fixture-source"}')`,
    ),
  ).rejects.toThrow(/unique constraint/);
});

it("prevents two pending source-search jobs for one artist", async () => {
  await db.exec(`INSERT INTO artist_research_jobs(artist_id,kind) VALUES('${a}','source_search')`);
  await expect(
    db.exec(`INSERT INTO artist_research_jobs(artist_id,kind) VALUES('${a}','source_search')`),
  ).rejects.toThrow(/unique constraint/);
});
