import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { ResearchJob } from "@/lib/research/types";
import { persistLatestProviderSnapshot } from "../persistLatestProviderSnapshot";
import { normalizeLatestProviderItems } from "../normalizeLatestProviderItems";
const client = new PGlite();
const driver = drizzle(client);
const tx = {
  execute: async (query: Parameters<typeof driver.execute>[0]) =>
    (await driver.execute(query)).rows,
};
vi.mock("@/lib/research/withResearchJobWrite", () => ({
  withResearchJobWrite: async (_a: unknown, _j: unknown, fn: (t: typeof tx) => unknown) => fn(tx),
}));
const artist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const job = { id: jobId, artistId: artist, updatedAt: "2026-10-09T00:00:00Z" } as ResearchJob;
const items = normalizeLatestProviderItems("deezer", "12", {
  data: [
    {
      id: 42,
      title: "Record",
      record_type: "single",
      release_date: "2026-01-02",
      link: "https://www.deezer.com/album/42",
    },
  ],
});
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid primary key,spotify text,deezer text,inprocess text);create table artist_research_jobs(id uuid,artist_id uuid,status text,updated_at timestamptz);create table artist_latest_provider_snapshots(artist_id uuid,provider text,account_id text,items jsonb,checked_at timestamptz,last_attempt_at timestamptz,status text,primary key(artist_id,provider));`,
  );
}, 30000);
beforeEach(async () => {
  await client.exec(
    `delete from artist_latest_provider_snapshots;delete from artists;delete from artist_research_jobs;insert into artists values('${artist}',null,'12',null);insert into artist_research_jobs values('${jobId}','${artist}','running','2026-10-09T00:00:00Z');`,
  );
});
afterAll(async () => client.close());
it("retains last successful snapshot on provider failure and clears removed items on successful empty refresh", async () => {
  await persistLatestProviderSnapshot(job, "deezer", "12", items);
  await persistLatestProviderSnapshot(job, "deezer", "12", null);
  let rows = await client.query<{ items: unknown[]; status: string }>(
    "select items,status from artist_latest_provider_snapshots",
  );
  expect(rows.rows[0].items).toHaveLength(1);
  expect(rows.rows[0].status).toBe("failed");
  await persistLatestProviderSnapshot(job, "deezer", "12", []);
  rows = await client.query("select items,status from artist_latest_provider_snapshots");
  expect(rows.rows[0].items).toEqual([]);
  expect(rows.rows[0].status).toBe("checked");
});
it("refuses late writes after provider connection or job lease changes", async () => {
  await client.exec("update artists set deezer='999'");
  await expect(persistLatestProviderSnapshot(job, "deezer", "12", items)).rejects.toThrow();
  await client.exec(
    "update artists set deezer='12';update artist_research_jobs set updated_at=now()",
  );
  await expect(persistLatestProviderSnapshot(job, "deezer", "12", items)).rejects.toThrow();
  expect((await client.query("select * from artist_latest_provider_snapshots")).rows).toEqual([]);
});
