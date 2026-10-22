import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { resetClaimBuild } from "../resetClaimBuild";

vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const client = new PGlite();
const database = drizzle(client);
const artistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeAll(async () => {
  // Minimal real Postgres schema for exactly the tables this reset touches, plus
  // the full mapping row whose identity/provenance must survive the operation.
  await client.exec(`
    CREATE TABLE artists (id uuid PRIMARY KEY, name text, spotify text, deezer text,
      instagram text, tiktok text, x text, youtube text, soundcloud text, bandcamp text,
      twitch text, facebook text, discogs text, bio text);
    CREATE TABLE artist_onboarding_steps (artist_id uuid, step text);
    CREATE TABLE artist_vault_sources (id uuid DEFAULT gen_random_uuid(), artist_id uuid, origin text);
    CREATE TABLE artist_docs (id uuid DEFAULT gen_random_uuid(), artist_id uuid);
    CREATE TABLE artist_research_jobs (id uuid DEFAULT gen_random_uuid(), artist_id uuid, status text);
    CREATE TABLE artist_id_mappings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artist_id uuid,
      platform text, platform_id text, confidence text, source text, reasoning text,
      api_key_hash text, resolved_at timestamptz, created_at timestamptz, updated_at timestamptz);
  `);
}, 30000);
afterAll(async () => client.close());

it("preserves catalog identity and mappings while resetting only the artist's research/build data", async () => {
  await client.query(
    `INSERT INTO artists (id,name,spotify,deezer,instagram,bio)
    VALUES ($1,'Artist','1234567890123456789012','42','research-handle','research bio'),
           ($2,'Other artist','abcdefghijklmnopqrstuv','84','other-handle','other bio')`,
    [artistId, otherId],
  );
  await client.query(
    `INSERT INTO artist_id_mappings
    (artist_id,platform,platform_id,confidence,source,reasoning,api_key_hash,resolved_at,created_at,updated_at)
    VALUES ($1,'spotify','1234567890123456789012','manual','confirmed','retained provenance','synthetic-hash',now(),now(),now()),
           ($1,'deezer','42','high','corroborated','retained proof',null,now(),now(),now())`,
    [artistId],
  );
  await client.query("INSERT INTO artist_onboarding_steps VALUES ($1,'profiles'),($2,'profiles')", [
    artistId,
    otherId,
  ]);
  await client.query(
    "INSERT INTO artist_vault_sources (artist_id,origin) VALUES ($1,'research'),($1,'upload'),($2,'research')",
    [artistId, otherId],
  );
  await client.query("INSERT INTO artist_docs (artist_id) VALUES ($1),($2)", [artistId, otherId]);
  await client.query(
    "INSERT INTO artist_research_jobs (artist_id,status) VALUES ($1,'pending'),($1,'running'),($1,'completed'),($2,'pending')",
    [artistId, otherId],
  );
  const mappingsBefore = (await client.query("SELECT * FROM artist_id_mappings ORDER BY platform"))
    .rows;
  const otherBefore = (await client.query("SELECT * FROM artists WHERE id=$1", [otherId])).rows;

  const removed = await resetClaimBuild(artistId);

  expect(
    (await client.query("SELECT * FROM artists WHERE id=$1", [artistId])).rows[0],
  ).toMatchObject({
    spotify: "1234567890123456789012",
    deezer: "42",
    instagram: null,
    bio: null,
  });
  expect((await client.query("SELECT * FROM artist_id_mappings ORDER BY platform")).rows).toEqual(
    mappingsBefore,
  );
  expect((await client.query("SELECT * FROM artists WHERE id=$1", [otherId])).rows).toEqual(
    otherBefore,
  );
  expect(removed).toEqual({
    steps: ["profiles"],
    links: { instagram: "research-handle" },
    bio: "research bio",
    doc: true,
    sources: 1,
    jobs: 2,
  });
  expect((await client.query("SELECT * FROM artist_onboarding_steps")).rows).toEqual([
    { artist_id: otherId, step: "profiles" },
  ]);
  expect(
    (await client.query("SELECT origin FROM artist_vault_sources WHERE artist_id=$1", [artistId]))
      .rows,
  ).toEqual([{ origin: "upload" }]);
  expect((await client.query("SELECT artist_id FROM artist_docs")).rows).toEqual([
    { artist_id: otherId },
  ]);
  expect(
    (await client.query("SELECT status FROM artist_research_jobs WHERE artist_id=$1", [artistId]))
      .rows,
  ).toEqual([{ status: "completed" }]);
  expect(
    (await client.query("SELECT status FROM artist_research_jobs WHERE artist_id=$1", [otherId]))
      .rows,
  ).toEqual([{ status: "pending" }]);
});
