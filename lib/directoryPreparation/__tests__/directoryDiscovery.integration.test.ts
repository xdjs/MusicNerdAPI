import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
const store = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
};
vi.mock("@/lib/db/db", () => ({
  db: { ...store, transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(store) },
}));
const { recordDirectoryDiscovery } = await import("../recordDirectoryDiscovery");
const { hasSavedDirectoryDiscovery } = await import("../hasSavedDirectoryDiscovery");
const { completeDirectoryDiscovery } = await import("../completeDirectoryDiscovery");
const { hasReusableDirectoryDiscovery } = await import("../hasReusableDirectoryDiscovery");
const a = "00000000-0000-4000-8000-000000000001",
  u = "00000000-0000-4000-8000-000000000002",
  e = "00000000-0000-4000-8000-000000000003",
  j = "00000000-0000-4000-8000-000000000004",
  s = "00000000-0000-4000-8000-000000000005",
  c = "00000000-0000-4000-8000-000000000006";
const job = {
  id: j,
  artistId: a,
  activityId: e,
  kind: "source_search" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 1,
  updatedAt: "2026-10-14T00:00:00.000Z",
  state: { claimId: null, purpose: "directory_preparation", creationActivityId: e },
};
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid,added_by uuid,name text,spotify text,deezer text);create table artist_activity_events(id uuid,artist_id uuid,actor_kind text,actor_user_id uuid,action text,trigger text);create table artist_claims(id uuid,artist_id uuid,status text);create table artist_vault_sources(id uuid,artist_id uuid,activity_id uuid,origin text,status text,body text,updated_at timestamptz default now());create table artist_research_jobs(id uuid,artist_id uuid,activity_id uuid,kind text,status text,attempts integer,state jsonb,updated_at timestamptz,claimed_at timestamptz,last_error text);create function knowledge_vault_source_snapshot(v artist_vault_sources) returns jsonb language sql as $$select jsonb_build_object('id',v.id,'body',v.body,'status',v.status,'updatedAt',v.updated_at)$$;`,
  );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    `truncate artists,artist_activity_events,artist_claims,artist_vault_sources,artist_research_jobs;insert into artists values('${a}','${u}','Example','spotify-id',null);insert into artist_activity_events values('${e}','${a}','user','${u}','directory_add','directory_add');insert into artist_vault_sources(id,artist_id,activity_id,origin,status,body) values('${s}','${a}','${e}','research','pending','Original');insert into artist_research_jobs values('${j}','${a}','${e}','source_search','running',1,'${JSON.stringify(job.state)}','2026-10-14T00:00:00Z',now(),null);`,
  );
});
const claim = () => client.exec(`insert into artist_claims values('${c}','${a}','approved')`);
const complete = async () => {
  const recorded = await recordDirectoryDiscovery(job);
  return recorded ? completeDirectoryDiscovery(recorded) : false;
};
const read = () => hasReusableDirectoryDiscovery(a, c);
it("records complete discovery atomically and reuses only after the current claim is approved", async () => {
  expect(await complete()).toBe(true);
  expect(await read()).toBe(false);
  await claim();
  expect(await read()).toBe(true);
  expect(await hasReusableDirectoryDiscovery(a, e)).toBe(false);
});
it.each(["approved", "rejected"])(
  "human %s review never triggers another discovery",
  async status => {
    await complete();
    await claim();
    await client.query("update artist_vault_sources set status=$1,updated_at=now()", [status]);
    expect(await read()).toBe(true);
  },
);
it("accepts completed empty discovery rather than treating empty as not run", async () => {
  await client.exec("truncate artist_vault_sources");
  await complete();
  await claim();
  expect(await read()).toBe(true);
});
it.each([
  "update artists set name='Different'",
  "update artists set spotify='different'",
  "update artist_vault_sources set body='Changed'",
  "delete from artist_vault_sources",
  "update artist_activity_events set actor_user_id=null",
  "update artist_claims set status='rejected'",
  "update artist_research_jobs set state=jsonb_set(state,'{directoryDiscovery,completedAt}',to_jsonb(extract(epoch from now()-interval '25 hours')*1000))",
  "update artist_research_jobs set state=jsonb_set(state,'{directoryDiscovery,completedAt}',to_jsonb(extract(epoch from now()+interval '1 hour')*1000))",
  "update artist_research_jobs set state=state-'directoryDiscovery'",
  "update artist_research_jobs set state=jsonb_set(state,'{directoryDiscovery,version}','2')",
  "update artist_research_jobs set state=jsonb_set(state,'{claimId}','\"some-claim\"')",
])("fails closed for changed, stale or incomplete discovery: %s", async sql => {
  await complete();
  await claim();
  await client.exec(sql);
  expect(await read()).toBe(false);
});
it("unrelated submitted material is still reviewed but does not invalidate completed discovery", async () => {
  await complete();
  await claim();
  await client.exec(
    `insert into artist_vault_sources(id,artist_id,origin,status,body) values('${c}','${a}','submission','pending','New user source')`,
  );
  expect(await read()).toBe(true);
});
it("any claim beginning blocks completion", async () => {
  await client.exec(`insert into artist_claims values('${c}','${a}','pending')`);
  await expect(complete()).rejects.toThrow("ownership changed");
  expect((await client.query("select status from artist_research_jobs")).rows).toEqual([
    { status: "running" },
  ]);
});
it("replaced leases cannot declare discovery complete", async () => {
  await client.exec("update artist_research_jobs set attempts=2");
  expect(await complete()).toBe(false);
  expect((await client.query("select state from artist_research_jobs")).rows).toEqual([
    { state: job.state },
  ]);
});

it.each(["pending", "running", "failed", "done"])(
  "completed discovery remains reusable while parent is %s for downstream retry",
  async status => {
    await recordDirectoryDiscovery(job);
    await claim();
    await client.query("update artist_research_jobs set status=$1,updated_at=now()", [status]);
    expect(await read()).toBe(true);
  },
);
it.each(["null", '"bad date"', "{}", "[]"])(
  "malformed checkpoint time %s is nonreusable without throwing",
  async time => {
    await complete();
    await claim();
    await client.query(
      "update artist_research_jobs set state=jsonb_set(state,'{directoryDiscovery,completedAt}',$1::jsonb)",
      [time],
    );
    expect(await read()).toBe(false);
  },
);
it("resumes the saved directory stage without changing its discovery time and rejects changed originals", async () => {
  const recorded = await recordDirectoryDiscovery(job);
  expect(recorded).not.toBeNull();
  expect(await hasSavedDirectoryDiscovery(recorded!)).toBe(true);
  const before = recorded!.state.directoryDiscovery;
  await completeDirectoryDiscovery(recorded!);
  expect((await client.query("select state from artist_research_jobs")).rows).toEqual([
    { state: { ...job.state, directoryDiscovery: before } },
  ]);
  await client.exec("update artist_vault_sources set body='Changed'");
  expect(await hasSavedDirectoryDiscovery(recorded!)).toBeNull();
});
it("a claim after discovery but before child enqueue reuses discovery while cancelling old directory authority", async () => {
  const recorded = await recordDirectoryDiscovery(job);
  await claim();
  expect(await read()).toBe(true);
  await expect(hasSavedDirectoryDiscovery(recorded!)).rejects.toThrow("ownership changed");
  await expect(completeDirectoryDiscovery(recorded!)).rejects.toThrow("ownership changed");
  expect((await client.query("select status from artist_research_jobs")).rows).toEqual([
    { status: "running" },
  ]);
});

it("changed inputs on a current retry require discovery but a replaced lease cannot start it", async () => {
  const recorded = await recordDirectoryDiscovery(job);
  await client.exec("update artist_vault_sources set body='Different'");
  expect(await hasSavedDirectoryDiscovery(recorded!)).toBe(false);
  await client.exec("update artist_research_jobs set attempts=2");
  expect(await hasSavedDirectoryDiscovery(recorded!)).toBeNull();
});
