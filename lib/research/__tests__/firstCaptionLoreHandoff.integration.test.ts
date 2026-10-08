import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { captionJob } from "@/lib/research/__tests__/captionJob";

const client = new PGlite();
const driver = drizzle(client, { schema });
const database = {
  ...driver,
  transaction: (fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(tx =>
      fn({
        ...tx,
        query: tx.query,
        insert: tx.insert.bind(tx),
        execute: async (query: Parameters<typeof tx.execute>[0]) => (await tx.execute(query)).rows,
      }),
    ),
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { queueLoreRefreshAfterCaptions } =
  await import("@/lib/research/queueLoreRefreshAfterCaptions");
const artistId = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000002";
const ownPostUrl = "https://www.tiktok.com/@firstartist/video/123456789";

beforeAll(async () => {
  await client.exec(`
    create table artists(id uuid primary key);
    create table artist_claims(id uuid primary key,user_id uuid,artist_id uuid,status text);
    create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
    create table artist_social_posts(id uuid primary key default gen_random_uuid(),artist_id uuid,url text,caption text);
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',cursor integer default 0,total integer,claimed_at timestamptz,attempts integer default 0,last_error text,state jsonb,activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
    create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
    insert into artists(id) values('${artistId}');
    insert into artist_social_posts(artist_id,url,caption) values('${artistId}','${ownPostUrl}','I made this song at home.');
    insert into artist_research_jobs(id,artist_id,kind,status,state) values('${jobId}','${artistId}','caption_extract','running','{}');
  `);
}, 30000);
afterAll(async () => client.close());

it("queues exactly one first Lore rebuild from stored captions, preserving the post URL without scraping", async () => {
  const job = { ...captionJob(), id: jobId, artistId };
  expect(await queueLoreRefreshAfterCaptions(job)).toBe(true);
  expect(await queueLoreRefreshAfterCaptions(job)).toBe(false);
  const { rows } = await client.query<{
    kind: string;
    status: string;
    claimId: string | null;
  }>(
    "select kind,status,state->>'claimId' as \"claimId\" from artist_research_jobs where kind='lore_refresh'",
  );
  expect(rows).toEqual([{ kind: "lore_refresh", status: "pending", claimId: null }]);
  const stored = await client.query<{ url: string }>(
    "select url from artist_social_posts where artist_id=$1",
    [artistId],
  );
  expect(stored.rows).toEqual([{ url: ownPostUrl }]);
  expect(
    (
      await client.query(
        "select count(*)::int as count from artist_research_jobs where kind='social_ingest'",
      )
    ).rows,
  ).toEqual([{ count: 0 }]);
});
