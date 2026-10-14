import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      driver.transaction(tx =>
        fn({
          execute: async (q: Parameters<typeof tx.execute>[0]) => (await tx.execute(q)).rows,
        }),
      ),
  },
}));
const { queueDirectoryPreparation } = await import("../queueDirectoryPreparation");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");
const artist = "00000000-0000-4000-8000-000000000001";
const event = "00000000-0000-4000-8000-000000000002";
const user = "00000000-0000-4000-8000-000000000003";
const queue = () =>
  withArtistOperation(
    artist,
    { expectedClaimId: null, trigger: "directory_add", activityId: event },
    () => queueDirectoryPreparation(artist),
  );
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid,added_by uuid);create table artist_activity_events(id uuid,artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text);create table artist_claims(artist_id uuid,status text);create table artist_research_jobs(id uuid default gen_random_uuid(),artist_id uuid,kind text,status text,activity_id uuid,state jsonb);create unique index one_live_job on artist_research_jobs(artist_id,kind) where status in ('pending','running');`,
  );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    `truncate artists,artist_activity_events,artist_claims,artist_research_jobs;insert into artists values('${artist}','${user}');insert into artist_activity_events values('${event}','${artist}','${user}','user','directory_add','directory_add');`,
  );
});
it("deduplicates retries while preserving the original directory authority", async () => {
  await queue();
  await queue();
  expect((await client.query("select activity_id,state from artist_research_jobs")).rows).toEqual([
    {
      activity_id: event,
      state: { claimId: null, purpose: "directory_preparation", creationActivityId: event },
    },
  ]);
});
it("does not adopt or alter an existing unrelated Lore job", async () => {
  await client.exec(
    `insert into artist_research_jobs(artist_id,kind,status,state) values('${artist}','lore_refresh','running','{"purpose":"manual_review"}')`,
  );
  await expect(queue()).rejects.toThrow("queue is busy");
  expect((await client.query("select state from artist_research_jobs")).rows).toEqual([
    { state: { purpose: "manual_review" } },
  ]);
});
it("rejects a directory event once a claim has started without creating a job", async () => {
  await client.exec(`insert into artist_claims values('${artist}','pending')`);
  await expect(queue()).rejects.toThrow("ownership changed");
  expect((await client.query("select * from artist_research_jobs")).rows).toHaveLength(0);
});
it("rejects missing creation scope without creating a job", async () => {
  await expect(queueDirectoryPreparation(artist)).rejects.toThrow("authority");
  expect((await client.query("select * from artist_research_jobs")).rows).toHaveLength(0);
});
