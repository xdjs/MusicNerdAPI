import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { queueClaimSourceSearch } from "../queueClaimSourceSearch";
import { queueClaimInterview } from "../queueClaimInterview";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";

vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const client = new PGlite();
const database = drizzle(client, { schema });
const artistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const claimant = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const admin = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const claimId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const asAdmin = <T>(fn: () => Promise<T>) =>
  withArtistOperation(
    artistId,
    { userId: admin, expectedClaimId: claimId, trigger: "claim_approval" },
    fn,
  );

beforeAll(async () => {
  await client.exec(`
    CREATE TYPE claim_status AS ENUM ('pending','approved','rejected');
    CREATE TABLE artists (id uuid PRIMARY KEY);
    CREATE TABLE users (id uuid PRIMARY KEY, email text, username text,
      username_needs_confirmation boolean NOT NULL DEFAULT false, username_prompted_at timestamptz,
      wallet text, privy_user_id text, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), legacy_id text, is_admin boolean NOT NULL DEFAULT false,
      is_white_listed boolean NOT NULL DEFAULT false, is_super_admin boolean NOT NULL DEFAULT false,
      is_hidden boolean NOT NULL DEFAULT false, legacy_link_dismissed boolean NOT NULL DEFAULT false,
      accepted_ugc_count bigint);
    CREATE TABLE artist_claims (id uuid PRIMARY KEY, user_id uuid NOT NULL, artist_id uuid NOT NULL,
      status claim_status NOT NULL, reference_code text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE artist_activity_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artist_id uuid,
      action text, actor_user_id uuid, actor_kind text, trigger text, source_id uuid,
      parent_activity_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE artist_research_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), artist_id uuid,
      kind text, status text NOT NULL DEFAULT 'pending', total int, state jsonb, activity_id uuid);
    CREATE UNIQUE INDEX live_job ON artist_research_jobs (artist_id, kind) WHERE status IN ('pending','running');
  `);
}, 30000);
beforeEach(async () => {
  await client.exec(
    "DELETE FROM artist_research_jobs; DELETE FROM artist_activity_events; DELETE FROM artist_claims; DELETE FROM users; DELETE FROM artists;",
  );
  await client.query("INSERT INTO artists (id) VALUES ($1)", [artistId]);
  await client.query("INSERT INTO users (id, is_admin) VALUES ($1,false),($2,true)", [
    claimant,
    admin,
  ]);
  await client.query(
    "INSERT INTO artist_claims (id,user_id,artist_id,status) VALUES ($1,$2,$3,'approved')",
    [claimId, claimant, artistId],
  );
});
afterAll(async () => client.close());

it("queues source research for the claim, attributed to the approving admin", async () => {
  expect(await asAdmin(() => queueClaimSourceSearch(artistId, claimId))).toBe(true);
  const { rows } = await client.query<{
    kind: string;
    state: { claimId: string };
    actor_user_id: string;
    trigger: string;
  }>(
    `SELECT j.kind, j.state, e.actor_user_id, e.trigger FROM artist_research_jobs j
     JOIN artist_activity_events e ON e.id = j.activity_id`,
  );
  expect(rows).toEqual([
    { kind: "source_search", state: { claimId }, actor_user_id: admin, trigger: "claim_approval" },
  ]);
});

it("counts a live search for the same claim as queued, and one for another claim as not", async () => {
  await client.query(
    `INSERT INTO artist_research_jobs (artist_id,kind,state) VALUES ($1,'source_search',$2)`,
    [artistId, JSON.stringify({ claimId })],
  );
  expect(await asAdmin(() => queueClaimSourceSearch(artistId, claimId))).toBe(true);
  await client.query(`UPDATE artist_research_jobs SET state='{"claimId":null}'`);
  expect(await asAdmin(() => queueClaimSourceSearch(artistId, claimId))).toBe(false);
});

it("refuses when the claim changed under the operation", async () => {
  await client.query("UPDATE artist_claims SET status='rejected'");
  await expect(asAdmin(() => queueClaimSourceSearch(artistId, claimId))).rejects.toThrow(
    "Artist ownership changed",
  );
});

it("queues private interview preparation once per claim", async () => {
  expect(await asAdmin(() => queueClaimInterview(artistId, claimId, claimant))).toBe(true);
  expect(await asAdmin(() => queueClaimInterview(artistId, claimId, claimant))).toBe(true);
  const { rows } = await client.query<{ kind: string; state: Record<string, unknown> }>(
    "SELECT kind, state FROM artist_research_jobs",
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: "interview_prepare",
    state: { version: 1, mode: "claim_preparation", claimId, userId: claimant },
  });
});
