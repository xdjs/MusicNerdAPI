import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import type { TransactionDb } from "@/lib/ownership/types";
import { resumeDirectorySocialJobs } from "../resumeDirectorySocialJobs";
const client = new PGlite(),
  driver = drizzle(client);
const tx = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
} as TransactionDb;
const a = "00000000-0000-4000-8000-000000000001",
  u = "00000000-0000-4000-8000-000000000002",
  e = "00000000-0000-4000-8000-000000000003",
  j = "00000000-0000-4000-8000-000000000004",
  c = "00000000-0000-4000-8000-000000000005";
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid,added_by uuid);create table artist_claims(id uuid,artist_id uuid,status text);create table artist_activity_events(id uuid,artist_id uuid,actor_kind text,actor_user_id uuid,action text,trigger text);create table artist_research_jobs(id uuid default gen_random_uuid(),artist_id uuid,activity_id uuid,kind text,status text default 'pending',cursor integer default 0,total integer,attempts integer default 0,state jsonb,claimed_at timestamptz,last_error text,created_at timestamptz default now(),updated_at timestamptz default now());create unique index active_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');`,
  );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    `truncate artists,artist_claims,artist_activity_events,artist_research_jobs;insert into artists values('${a}','${u}');insert into artist_claims values('${c}','${a}','approved');insert into artist_activity_events values('${e}','${a}','user','${u}','directory_add','directory_add');`,
  );
});
const put = async (kind: string, state: object, status = "running") => {
  await client.query(
    `insert into artist_research_jobs(id,artist_id,activity_id,kind,status,cursor,total,attempts,state) values($1,$2,$3,$4,$5,9,20,1,$6)`,
    [j, a, e, kind, status, JSON.stringify({ directoryActivityId: e, ...state })],
  );
};
const run = () => resumeDirectorySocialJobs(tx, a, c, e);
it("hands a paid run to a new claim job without losing dataset, cursor or provider state", async () => {
  await put("social_ingest", {
    apifyRunId: "paid-run",
    apifyDatasetId: "saved-dataset",
    additionalSocial: { index: 1, tasks: [{ runId: "x-run" }] },
  });
  expect(await run()).toBe(true);
  const rows = (
    await client.query<{ id: string; status: string; state: Record<string, unknown> }>(
      `select * from artist_research_jobs order by created_at,id`,
    )
  ).rows;
  const old = rows.find(r => r.id === j)!,
    fresh = rows.find(r => r.id !== j)!;
  expect(old.status).toBe("done");
  expect((old.state as Record<string, unknown>).directoryHandedOffToClaim).toBe(c);
  expect(fresh).toMatchObject({ cursor: 9, total: 20, attempts: 1, status: "pending" });
  expect(fresh.state).toMatchObject({
    apifyRunId: "paid-run",
    apifyDatasetId: "saved-dataset",
    claimId: c,
    resumedFromDirectoryJobId: j,
  });
  expect(fresh.state).not.toHaveProperty("directoryActivityId");
  expect(await run()).toBe(true);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 2 },
  ]);
});
it("recovers caption progress without starting another social scrape", async () => {
  await put("caption_extract", { sweepCursor: 2, swept: false });
  expect(await run()).toBe(true);
  expect(
    (
      await client.query(
        `select kind,cursor,state->>'sweepCursor' as sweep from artist_research_jobs where id<>'${j}'`,
      )
    ).rows,
  ).toEqual([{ kind: "caption_extract", cursor: 9, sweep: "2" }]);
});
it("does not blindly restart an uncertain provider start", async () => {
  await put("social_ingest", { instagramStartRequested: true });
  await run();
  expect(
    (
      await client.query(
        `select state->>'instagramStartRequested' as uncertain from artist_research_jobs where id<>'${j}'`,
      )
    ).rows,
  ).toEqual([{ uncertain: "true" }]);
});
it("finished social work without its child recovers caption work only", async () => {
  await put("social_ingest", { directorySocialComplete: true }, "done");
  await run();
  expect(
    (await client.query(`select kind from artist_research_jobs where id<>'${j}'`)).rows,
  ).toEqual([{ kind: "caption_extract" }]);
});
it("finished captions need no replacement", async () => {
  await put("caption_extract", { directoryCaptionsComplete: true }, "done");
  expect(await run()).toBe(true);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
});
it("revoked claim cannot adopt directory jobs", async () => {
  await put("social_ingest", { apifyRunId: "r" });
  await client.exec("update artist_claims set status='rejected'");
  await expect(run()).rejects.toThrow("ownership changed");
  expect((await client.query("select status from artist_research_jobs")).rows).toEqual([
    { status: "running" },
  ]);
});
it("an unrelated event cannot be adopted", async () => {
  await put("social_ingest", { apifyRunId: "r" });
  await client.exec("update artist_activity_events set action='other'");
  expect(await run()).toBe(false);
  expect((await client.query("select status from artist_research_jobs")).rows).toEqual([
    { status: "running" },
  ]);
});
it("a live incompatible job prevents handoff without retiring original work", async () => {
  await put("social_ingest", { apifyRunId: "r" });
  await client.query(
    `insert into artist_research_jobs(artist_id,kind,state) values($1,'caption_extract','{}')`,
    [a],
  );
  await expect(run()).rejects.toThrow("must finish");
  expect(
    (
      await client.query(
        `select status,state->>'directoryHandedOffToClaim' as handoff from artist_research_jobs where id='${j}'`,
      )
    ).rows,
  ).toEqual([{ status: "running", handoff: null }]);
});
it("an explicit refresh is not swallowed by a completed handoff", async () => {
  await put("caption_extract", { directoryCaptionsComplete: true }, "done");
  await run();
  expect(await resumeDirectorySocialJobs(tx, a, c, e, true)).toBe(false);
});
