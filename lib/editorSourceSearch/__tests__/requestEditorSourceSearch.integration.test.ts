import { PGlite } from "@electric-sql/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import * as schema from "@/lib/db/schema";
const client = new PGlite();
const driver = drizzle(client, { schema });
const database = {
  ...driver,
  query: driver.query,
  select: driver.select.bind(driver),
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  transaction: (fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(tx =>
      fn({
        ...tx,
        query: tx.query,
        select: tx.select.bind(tx),
        insert: tx.insert.bind(tx),
        execute: async (q: Parameters<typeof tx.execute>[0]) => (await tx.execute(q)).rows,
      }),
    ),
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { requestEditorSourceSearch } = await import("../requestEditorSourceSearch");
const { getEditorSourceSearch } = await import("../getEditorSourceSearch");
const artist = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const claim = "00000000-0000-4000-8000-000000000003";
const requestId = "00000000-0000-4000-8000-000000000004";
const nextId = "00000000-0000-4000-8000-000000000005";
beforeAll(async () => {
  await client.exec(`
create table artists(id uuid primary key,name text,bio text);
create table users(${getTableConfig(schema.users)
    .columns.map(c => `"${c.name}" ${c.getSQLType()}`)
    .join(",")});
create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text);
create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',state jsonb,claimed_at timestamptz,last_error text,activity_id uuid,attempts int default 0,cursor int default 0,total int,created_at timestamptz default now(),updated_at timestamptz default now());
create unique index one_active_job on artist_research_jobs(artist_id,kind) where status in ('pending','running');
create table artist_vault_sources(id uuid primary key default gen_random_uuid(),artist_id uuid,activity_id uuid);
insert into artists values('${artist}','Artist',null);insert into users(id,is_admin) values('${user}',false);`);
}, 30000);
beforeEach(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("External requests forbidden");
    }),
  );
  await client.exec(
    `delete from artist_research_jobs;delete from artist_activity_events;delete from artist_vault_sources;delete from artist_claims;insert into artist_claims values('${claim}','${artist}','${user}','approved');`,
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await client.close();
});
it("queues only source search and replays the same request before cooldown", async () => {
  const a = await requestEditorSourceSearch(artist, user, requestId);
  expect(a).toMatchObject({ status: "ok", requestId, phase: "pending", count: 0 });
  expect(await requestEditorSourceSearch(artist, user, requestId)).toEqual(a);
  expect(
    (await client.query<Record<string, unknown>>("select kind,state from artist_research_jobs"))
      .rows,
  ).toEqual([{ kind: "source_search", state: { mode: "editor_source_search", claimId: claim } }]);
  await expect(requestEditorSourceSearch(artist, user, nextId)).rejects.toMatchObject({
    status: 409,
  });
});
it("retains the receipt after job deletion, prevents replay and preserves cooldown", async () => {
  await requestEditorSourceSearch(artist, user, requestId);
  await client.exec("delete from artist_research_jobs");
  expect(await requestEditorSourceSearch(artist, user, requestId)).toMatchObject({
    phase: "interrupted",
  });
  await expect(requestEditorSourceSearch(artist, user, nextId)).rejects.toMatchObject({
    status: 429,
  });
  expect(
    (await client.query<Record<string, unknown>>("select * from artist_research_jobs")).rows,
  ).toHaveLength(0);
});
it("does not recycle a UUID for another purpose or requester", async () => {
  await client.exec(
    `insert into artist_activity_events(id,artist_id,actor_user_id,actor_kind,action,trigger) values('${requestId}','${artist}','${user}','user','other','editor_search')`,
  );
  await expect(requestEditorSourceSearch(artist, user, requestId)).rejects.toMatchObject({
    status: 409,
  });
  await client.exec(`update artist_activity_events set action='source_search',actor_user_id=null`);
  await expect(requestEditorSourceSearch(artist, user, requestId)).rejects.toMatchObject({
    status: 409,
  });
});
it("status reauthorizes and counts only this activity's retained sources", async () => {
  const a = await requestEditorSourceSearch(artist, user, requestId);
  await client.exec(
    `insert into artist_vault_sources(artist_id,activity_id) values('${artist}','${requestId}'),('${artist}','${nextId}');update artist_research_jobs set status='done'`,
  );
  expect(await getEditorSourceSearch(artist, user, requestId)).toMatchObject({
    jobId: a.jobId,
    phase: "done",
    count: 1,
  });
  await client.exec(`update artist_claims set status='revoked'`);
  await expect(getEditorSourceSearch(artist, user, requestId)).rejects.toMatchObject({
    status: 403,
  });
  await expect(requestEditorSourceSearch(artist, user, requestId)).rejects.toMatchObject({
    status: 403,
  });
});
it("unknown status never queues work", async () => {
  await expect(getEditorSourceSearch(artist, user, requestId)).rejects.toMatchObject({
    status: 404,
  });
  expect(
    (await client.query<Record<string, unknown>>("select * from artist_research_jobs")).rows,
  ).toHaveLength(0);
});
const search = vi.hoisted(() => vi.fn());
vi.mock("@/lib/vault/searchAndPopulateVault", () => ({ searchAndPopulateVault: search }));
const { runEditorSourceSearchJob } = await import("../runEditorSourceSearchJob");
const { toResearchJob } = await import("@/lib/research/toResearchJob");
async function claimed() {
  await requestEditorSourceSearch(artist, user, requestId);
  return toResearchJob(
    (
      await client.query<Record<string, unknown>>(
        `update artist_research_jobs set status='running',updated_at=now(),claimed_at=now() returning *,updated_at::text as lease_updated_at`,
      )
    ).rows[0],
  );
}
it("executes once, retains attribution, and never replays a started attempt", async () => {
  const job = await claimed();
  search.mockReset().mockResolvedValue([]);
  expect(await runEditorSourceSearchJob(job, Date.now() + 51000)).toMatchObject({ done: true });
  expect(search).toHaveBeenCalledTimes(1);
  expect(await getEditorSourceSearch(artist, user, requestId)).toMatchObject({ phase: "done" });
  await runEditorSourceSearchJob(job, Date.now() + 51000);
  expect(search).toHaveBeenCalledTimes(1);
});
it("reclaims an interrupted start without repeating provider work", async () => {
  let job = await claimed();
  search.mockReset();
  await client.exec(
    `update artist_research_jobs set state=state || '{"executionStarted":true}'::jsonb,updated_at=now()`,
  );
  job = toResearchJob(
    (
      await client.query<Record<string, unknown>>(
        "select *,updated_at::text as lease_updated_at from artist_research_jobs",
      )
    ).rows[0],
  );
  expect(await runEditorSourceSearchJob(job, Date.now() + 51000)).toMatchObject({ done: true });
  expect(search).not.toHaveBeenCalled();
  expect(await getEditorSourceSearch(artist, user, requestId)).toMatchObject({
    phase: "interrupted",
  });
});
it("fences stale workers and cancels revoked ownership before provider work", async () => {
  const job = await claimed();
  search.mockReset();
  await client.exec(`update artist_research_jobs set updated_at=updated_at+interval '1 second'`);
  expect(await runEditorSourceSearchJob(job, Date.now() + 51000)).toMatchObject({ waiting: true });
  expect(search).not.toHaveBeenCalled();
  const current = toResearchJob(
    (
      await client.query<Record<string, unknown>>(
        "select *,updated_at::text as lease_updated_at from artist_research_jobs",
      )
    ).rows[0],
  );
  await client.exec(`update artist_claims set status='revoked'`);
  expect(await runEditorSourceSearchJob(current, Date.now() + 51000)).toMatchObject({ done: true });
  expect(search).not.toHaveBeenCalled();
});
it("keeps a failed provider start terminal and allows short slices without starting", async () => {
  let job = await claimed();
  search.mockReset().mockRejectedValue(new Error("sensitive provider error"));
  expect(await runEditorSourceSearchJob(job, Date.now() + 1000)).toMatchObject({ waiting: true });
  expect(search).not.toHaveBeenCalled();
  job = toResearchJob(
    (
      await client.query<Record<string, unknown>>(
        `update artist_research_jobs set status='running',updated_at=now() returning *,updated_at::text as lease_updated_at`,
      )
    ).rows[0],
  );
  expect(await runEditorSourceSearchJob(job, Date.now() + 51000)).toMatchObject({ done: true });
  expect(search).toHaveBeenCalledTimes(1);
  expect(await getEditorSourceSearch(artist, user, requestId)).toMatchObject({ phase: "failed" });
  expect(JSON.stringify(await getEditorSourceSearch(artist, user, requestId))).not.toContain(
    "sensitive",
  );
});
it("can settle an expired started editor lease at the attempt cap", async () => {
  await claimed();
  search.mockReset();
  await client.exec(
    `alter table artist_vault_sources add column if not exists status text;alter table artist_vault_sources add column if not exists extracted_text text;create table if not exists artist_social_posts(artist_id uuid,is_own_post boolean,caption text);update artist_research_jobs set attempts=4,claimed_at=now()-interval '4 minutes',state=state||'{"executionStarted":true}'::jsonb`,
  );
  const { claimResearchJob } = await import("@/lib/research/claimResearchJob");
  const job = await claimResearchJob({ kinds: ["source_search"], artistId: artist });
  expect(job).not.toBeNull();
  expect(await runEditorSourceSearchJob(job!, Date.now() + 51000)).toMatchObject({ done: true });
  expect(search).not.toHaveBeenCalled();
  expect(await getEditorSourceSearch(artist, user, requestId)).toMatchObject({
    phase: "interrupted",
  });
});
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: async () => ({
    artistId: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
  }),
}));
it("joins HTTP request, actual claim/advance, attributed persistence and status without repeating transport retries", async () => {
  const { editorSourceSearchHandler } = await import("../editorSourceSearchHandler");
  const { advanceResearch } = await import("@/lib/research/advanceResearch");
  const { getArtistOperationOwnership } =
    await import("@/lib/ownership/getArtistOperationOwnership");
  const post = () =>
    editorSourceSearchHandler(
      new Request("https://example.test", { method: "POST", body: JSON.stringify({ requestId }) }),
      artist,
    );
  expect((await post()).status).toBe(200);
  expect((await post()).status).toBe(200);
  search.mockReset().mockImplementation(async () => {
    expect(getArtistOperationOwnership(artist)).toMatchObject({
      userId: user,
      activityId: requestId,
      expectedClaimId: claim,
      sourceOrigin: "research",
    });
    await client.exec(
      `insert into artist_vault_sources(artist_id,activity_id) values('${artist}','${requestId}')`,
    );
    return [];
  });
  expect(
    await advanceResearch({ artistId: artist, kinds: ["source_search"], budgetMs: 56000 }),
  ).toMatchObject({ done: true });
  expect(
    await advanceResearch({ artistId: artist, kinds: ["source_search"], budgetMs: 56000 }),
  ).toEqual({ ran: false });
  const status = await editorSourceSearchHandler(
    new Request(`https://example.test?requestId=${requestId}`),
    artist,
  );
  expect(status.headers.get("cache-control")).toBe("private, no-store");
  expect(await status.json()).toMatchObject({ phase: "done", count: 1 });
  expect(await (await post()).json()).toMatchObject({ phase: "done", count: 1 });
  expect(search).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});
it("settles an unstarted attempt at the cap even when the slice is short", async () => {
  await claimed();
  search.mockReset();
  await client.exec(
    `update artist_research_jobs set attempts=4,claimed_at=now()-interval '4 minutes'`,
  );
  const { claimResearchJob } = await import("@/lib/research/claimResearchJob");
  const job = await claimResearchJob({ kinds: ["source_search"], artistId: artist });
  expect(job).not.toBeNull();
  expect(await runEditorSourceSearchJob(job!, Date.now() + 1000)).toMatchObject({ done: true });
  expect(search).not.toHaveBeenCalled();
  expect(await getEditorSourceSearch(artist, user, requestId)).toMatchObject({ phase: "failed" });
});

it("queues and starts once for an admin without an artist claim", async () => {
  await client.exec(`delete from artist_claims;update users set is_admin=true where id='${user}'`);
  try {
    expect(await requestEditorSourceSearch(artist, user, requestId)).toMatchObject({
      phase: "pending",
    });
    const rows = (await client.query<{ state: unknown }>("select state from artist_research_jobs"))
      .rows;
    expect(rows).toEqual([{ state: { mode: "editor_source_search", claimId: null } }]);
    search.mockReset().mockResolvedValue([]);
    const job = await claimed();
    expect(await runEditorSourceSearchJob(job, Date.now() + 51000)).toMatchObject({ done: true });
    expect(search).toHaveBeenCalledTimes(1);
    await runEditorSourceSearchJob(job, Date.now() + 51000);
    expect(search).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await client.exec(`update users set is_admin=false where id='${user}'`);
  }
});
