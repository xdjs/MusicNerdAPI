import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";
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
const CLAIM = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const OWNED = [
  "artist_research_jobs",
  "artist_social_credits",
  "artist_doc_corrections",
  "artist_vault_sources",
  "artist_social_posts",
  "artist_social_refreshes",
  "artist_social_profiles",
  "artist_interview_answers",
  "artist_onboarding_steps",
  "artist_docs",
];

beforeAll(async () => {
  await client.exec(`
    CREATE TABLE artists (id uuid PRIMARY KEY, bio text);
    CREATE TABLE artist_claims (id uuid PRIMARY KEY, user_id uuid, artist_id uuid, status text, reference_code text);
    CREATE TABLE artist_bio_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artist_id uuid, bio_text text, is_pinned boolean);
    ${OWNED.map(t => `CREATE TABLE ${t} (artist_id uuid);`).join("\n")}
  `);
}, 30000);
beforeEach(async () => {
  await client.exec(
    ["artists", "artist_claims", "artist_bio_versions", ...OWNED]
      .map(t => `DELETE FROM ${t};`)
      .join(""),
  );
  await client.query("INSERT INTO artists (id,bio) VALUES ($1,'Written bio'),($2,'Other bio')", [
    A,
    OTHER,
  ]);
  await client.query(
    "INSERT INTO artist_claims (id,user_id,artist_id,status,reference_code) VALUES ($1,$2,$3,'approved','MN-ABCD')",
    [CLAIM, OTHER, A],
  );
  for (const t of OWNED)
    await client.query(`INSERT INTO ${t} (artist_id) VALUES ($1),($2)`, [A, OTHER]);
  await client.query(
    "INSERT INTO artist_bio_versions (artist_id,bio_text,is_pinned) VALUES ($1,'Pinned',true)",
    [A],
  );
});
afterAll(async () => client.close());

it("deletes the claim and everything the claimant added, for that artist only", async () => {
  expect(await revokeApprovedClaim(CLAIM)).toMatchObject({
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

it("unpins the bio, keeps it in history and clears it from the page", async () => {
  await revokeApprovedClaim(CLAIM);
  const { rows } = await client.query<{ bio_text: string; is_pinned: boolean }>(
    "SELECT bio_text, is_pinned FROM artist_bio_versions ORDER BY bio_text",
  );
  expect(rows).toEqual([
    { bio_text: "Pinned", is_pinned: false },
    { bio_text: "Written bio", is_pinned: false },
  ]);
  expect((await client.query("SELECT bio FROM artists WHERE id=$1", [A])).rows).toEqual([
    { bio: null },
  ]);
});

it("leaves the bio alone when there was no Lore and no pin", async () => {
  await client.exec("DELETE FROM artist_docs; DELETE FROM artist_bio_versions;");
  await revokeApprovedClaim(CLAIM);
  expect((await client.query("SELECT bio FROM artists WHERE id=$1", [A])).rows).toEqual([
    { bio: "Written bio" },
  ]);
  expect((await client.query("SELECT 1 FROM artist_bio_versions")).rows).toHaveLength(0);
});

it("doesn't save the empty-state placeholder as a bio version", async () => {
  await client.query("UPDATE artists SET bio=$1 WHERE id=$2", [ABOUT_EMPTY_STATE, A]);
  await revokeApprovedClaim(CLAIM);
  expect((await client.query("SELECT 1 FROM artist_bio_versions")).rows).toHaveLength(1);
});

it("does nothing for a claim that isn't approved", async () => {
  await client.query("UPDATE artist_claims SET status='rejected'");
  expect(await revokeApprovedClaim(CLAIM)).toBeUndefined();
  expect((await client.query("SELECT 1 FROM artist_docs")).rows).toHaveLength(2);
});
