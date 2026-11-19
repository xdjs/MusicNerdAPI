import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
import { RevocationReviewRequiredError } from "../RevocationReviewRequiredError";
import { revokeApprovedClaim } from "../revokeApprovedClaim";

vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const client = new PGlite();
const database = drizzle(client);
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLAIMANT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TRUSTED = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CLAIM = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const STORAGE = "https://store.example.test";
const IMAGE = `${STORAGE}/storage/v1/object/public/vault-files/profile-images/${A}_1.png`;
/** Deleted for the revoked artist and kept for others; sources are checked on their own. */
const OWNED = [
  "artist_research_jobs",
  "artist_social_credits",
  "artist_doc_corrections",
  "artist_social_posts",
  "artist_social_refreshes",
  "artist_social_profiles",
  "artist_interview_answers",
  "artist_onboarding_steps",
  "artist_docs",
];
const S = {
  research: "10000000-0000-4000-8000-000000000001",
  own: "10000000-0000-4000-8000-000000000002",
  trusted: "10000000-0000-4000-8000-000000000003",
  other: "10000000-0000-4000-8000-000000000004",
};
const E = {
  own: "20000000-0000-4000-8000-000000000002",
  trusted: "20000000-0000-4000-8000-000000000003",
};

beforeAll(async () => {
  await client.exec(`
    CREATE SCHEMA mn_private;
    CREATE TABLE artists (id uuid PRIMARY KEY, bio text, custom_image text);
    CREATE TABLE artist_claims (id uuid PRIMARY KEY, user_id uuid, artist_id uuid, status text, reference_code text);
    CREATE TABLE artist_bio_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artist_id uuid, bio_text text, is_pinned boolean);
    CREATE TABLE mn_private.artist_bio_provenance (artist_id uuid PRIMARY KEY, provenance jsonb);
    CREATE TABLE mn_private.artist_bio_version_provenance (version_id uuid PRIMARY KEY, provenance jsonb);
    CREATE TABLE mcp_audit_log (artist_id uuid, field text, action text, old_value text, new_value text, api_key_hash text);
    CREATE TABLE artist_activity_events (id uuid PRIMARY KEY, artist_id uuid, actor_user_id uuid, actor_kind text, action text, trigger text, source_id uuid);
    CREATE TABLE artist_vault_sources (id uuid PRIMARY KEY, artist_id uuid, activity_id uuid, origin text, file_path text);
    ${OWNED.map(t => `CREATE TABLE ${t} (artist_id uuid);`).join("\n")}
  `);
}, 30000);
beforeEach(async () => {
  vi.stubEnv("SUPABASE_URL", `${STORAGE}/`);
  await client.exec(
    [
      "artists",
      "artist_claims",
      "artist_bio_versions",
      "mn_private.artist_bio_provenance",
      "mn_private.artist_bio_version_provenance",
      "mcp_audit_log",
      "artist_activity_events",
      "artist_vault_sources",
      ...OWNED,
    ]
      .map(t => `DELETE FROM ${t};`)
      .join(""),
  );
  await client.query(
    "INSERT INTO artists (id,bio,custom_image) VALUES ($1,'Written bio',$2),($3,'Other bio',$4)",
    [
      A,
      IMAGE,
      OTHER,
      `${STORAGE}/storage/v1/object/public/vault-files/profile-images/${OTHER}_1.png`,
    ],
  );
  await client.query(
    "INSERT INTO artist_claims (id,user_id,artist_id,status,reference_code) VALUES ($1,$2,$3,'approved','MN-ABCD')",
    [CLAIM, CLAIMANT, A],
  );
  for (const t of OWNED)
    await client.query(`INSERT INTO ${t} (artist_id) VALUES ($1),($2)`, [A, OTHER]);
  await client.query(
    "INSERT INTO artist_bio_versions (artist_id,bio_text,is_pinned) VALUES ($1,'Pinned',true)",
    [A],
  );
  await client.query(
    `INSERT INTO artist_activity_events (id,artist_id,actor_user_id,actor_kind,action,trigger,source_id) VALUES
     ($1,$3,$4,'user','source_upload','dashboard',$5),
     ($2,$3,$6,'user','source_upload','trusted_submission',$7)`,
    [E.own, E.trusted, A, CLAIMANT, S.own, TRUSTED, S.trusted],
  );
  await client.query(
    `INSERT INTO artist_vault_sources (id,artist_id,activity_id,origin,file_path) VALUES
     ($1,$5,null,'research',null),
     ($2,$5,$6,'upload',$8),
     ($3,$5,$7,'upload',$9),
     ($4,$10,null,'research',null)`,
    [
      S.research,
      S.own,
      S.trusted,
      S.other,
      A,
      E.own,
      E.trusted,
      `${A}/own.pdf`,
      `${A}/trusted.pdf`,
      OTHER,
    ],
  );
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => client.close());

const ids = async (sql: string, params: unknown[] = []) =>
  (await client.query<{ id: string }>(sql, params)).rows.map(r => r.id).sort();

it("deletes the claim and what the claimant added, for that artist only", async () => {
  expect(await revokeApprovedClaim(CLAIM, "admin1")).toMatchObject({
    id: CLAIM,
    artistId: A,
    status: "approved",
    referenceCode: "MN-ABCD",
  });
  expect((await client.query("SELECT 1 FROM artist_claims")).rows).toHaveLength(0);
  for (const t of OWNED)
    expect((await client.query<{ artist_id: string }>(`SELECT artist_id FROM ${t}`)).rows).toEqual([
      { artist_id: OTHER },
    ]);
});

it("keeps a verified trusted submission and deletes research and the claimant's own upload", async () => {
  await revokeApprovedClaim(CLAIM, "admin1");
  expect(await ids("SELECT id FROM artist_vault_sources")).toEqual([S.trusted, S.other].sort());
});

it("clears a managed profile image link, keeps the file and records both deferrals", async () => {
  await revokeApprovedClaim(CLAIM, "admin1");
  const { rows } = await client.query<{ id: string; custom_image: string | null }>(
    "SELECT id, custom_image FROM artists ORDER BY id",
  );
  expect(rows[0]).toEqual({ id: A, custom_image: null });
  expect(rows[1].custom_image).not.toBeNull();
  const audit = await client.query<Record<string, string | null>>(
    "SELECT artist_id, field, action, old_value, new_value, api_key_hash FROM mcp_audit_log ORDER BY field DESC",
  );
  expect(audit.rows).toEqual([
    {
      artist_id: A,
      field: "claim_profile_cleanup_deferred",
      action: "delete",
      old_value: IMAGE,
      new_value: "Object retained; generation verification required before cleanup",
      api_key_hash: "admin:admin1",
    },
    {
      artist_id: A,
      field: "claim_cleanup_deferred",
      action: "delete",
      old_value: JSON.stringify({
        claimId: CLAIM,
        sources: [
          { id: S.research, filePath: null },
          { id: S.own, filePath: `${A}/own.pdf` },
        ],
      }),
      new_value:
        "Storage cleanup deferred: object generation cannot be verified; no prefix deletion authorized.",
      api_key_hash: "admin:admin1",
    },
  ]);
});

it("leaves a profile image hosted elsewhere alone", async () => {
  await client.query(
    "UPDATE artists SET custom_image='https://cdn.example.test/a.png' WHERE id=$1",
    [A],
  );
  await revokeApprovedClaim(CLAIM, "admin1");
  expect((await client.query("SELECT custom_image FROM artists WHERE id=$1", [A])).rows).toEqual([
    { custom_image: "https://cdn.example.test/a.png" },
  ]);
  expect(
    (await client.query("SELECT 1 FROM mcp_audit_log WHERE field='claim_profile_cleanup_deferred'"))
      .rows,
  ).toHaveLength(0);
});

it("changes nothing when a source's provenance is unknown", async () => {
  await client.query("UPDATE artist_vault_sources SET activity_id=null WHERE id=$1", [S.own]);
  await expect(revokeApprovedClaim(CLAIM, "admin1")).rejects.toBeInstanceOf(
    RevocationReviewRequiredError,
  );
  expect((await client.query("SELECT 1 FROM artist_claims")).rows).toHaveLength(1);
  expect((await client.query("SELECT 1 FROM artist_vault_sources")).rows).toHaveLength(4);
  expect((await client.query("SELECT 1 FROM mcp_audit_log")).rows).toHaveLength(0);
});

it("unpins the bio, keeps it and its lineage in history and clears it from the page", async () => {
  await client.query(
    `INSERT INTO mn_private.artist_bio_provenance (artist_id,provenance) VALUES ($1,'{"version":1,"kind":"manual"}')`,
    [A],
  );
  await revokeApprovedClaim(CLAIM, "admin1");
  const { rows } = await client.query<{
    bio_text: string;
    is_pinned: boolean;
    provenance: unknown;
  }>(
    `SELECT v.bio_text, v.is_pinned, p.provenance FROM artist_bio_versions v
     LEFT JOIN mn_private.artist_bio_version_provenance p ON p.version_id=v.id ORDER BY v.bio_text`,
  );
  expect(rows).toEqual([
    { bio_text: "Pinned", is_pinned: false, provenance: null },
    { bio_text: "Written bio", is_pinned: false, provenance: { version: 1, kind: "manual" } },
  ]);
  expect((await client.query("SELECT bio FROM artists WHERE id=$1", [A])).rows).toEqual([
    { bio: null },
  ]);
  expect((await client.query("SELECT 1 FROM mn_private.artist_bio_provenance")).rows).toHaveLength(
    0,
  );
});

it("leaves the bio alone when there was no Lore and no pin", async () => {
  await client.exec("DELETE FROM artist_docs; DELETE FROM artist_bio_versions;");
  await revokeApprovedClaim(CLAIM, "admin1");
  expect((await client.query("SELECT bio FROM artists WHERE id=$1", [A])).rows).toEqual([
    { bio: "Written bio" },
  ]);
  expect((await client.query("SELECT 1 FROM artist_bio_versions")).rows).toHaveLength(0);
});

it("doesn't save the empty-state placeholder as a bio version", async () => {
  await client.query("UPDATE artists SET bio=$1 WHERE id=$2", [ABOUT_EMPTY_STATE, A]);
  await revokeApprovedClaim(CLAIM, "admin1");
  expect((await client.query("SELECT 1 FROM artist_bio_versions")).rows).toHaveLength(1);
});

it("does nothing for a claim that isn't approved", async () => {
  await client.query("UPDATE artist_claims SET status='rejected'");
  expect(await revokeApprovedClaim(CLAIM, "admin1")).toBeUndefined();
  expect((await client.query("SELECT 1 FROM artist_docs")).rows).toHaveLength(2);
  expect((await client.query("SELECT 1 FROM artist_vault_sources")).rows).toHaveLength(4);
});
