import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { toResearchJob } from "@/lib/research/toResearchJob";
import { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";
const client = new PGlite();
const driver = drizzle(client, { schema });
const database = {
  ...driver,
  execute: async (query: Parameters<typeof driver.execute>[0]) => {
    const result = await driver.execute(query);
    // Match postgres-js timestamp parsing: timestamptz becomes Date, losing microseconds.
    return result.rows.map(row => ({
      ...row,
      ...(row.updated_at ? { updated_at: new Date(String(row.updated_at)) } : {}),
    }));
  },
  transaction: (fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(tx =>
      fn({
        ...tx,
        query: tx.query,
        insert: tx.insert.bind(tx),
        update: tx.update.bind(tx),
        execute: async (query: Parameters<typeof tx.execute>[0]) => (await tx.execute(query)).rows,
      }),
    ),
};
const fetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
vi.mock("@/lib/sourceExtraction/fetchSourceText", () => ({ fetchSourceText: fetch }));
const { queueApprovedSourceExtraction } =
  await import("@/lib/sourceExtraction/queueApprovedSourceExtraction");
const { checkpointSourceExtraction } =
  await import("@/lib/sourceExtraction/checkpointSourceExtraction");
const { runSourceExtraction } = await import("@/lib/sourceExtraction/runSourceExtraction");
const { insertVaultSource } = await import("@/lib/vault/insertVaultSource");
const { claimResearchJob } = await import("@/lib/research/claimResearchJob");
const { updateVaultSourceStatus } = await import("@/lib/vault/updateVaultSourceStatus");
const artist = "00000000-0000-4000-8000-000000000001",
  owner = "00000000-0000-4000-8000-000000000002",
  claim = "00000000-0000-4000-8000-000000000003",
  source = "00000000-0000-4000-8000-000000000004",
  contributor = "00000000-0000-4000-8000-000000000005";
const row = {
  id: source,
  artistId: artist,
  url: "https://artist.example/interview",
  status: "approved",
};
const fetched = {
  status: "ready" as const,
  text: "The artist's original words.",
  capturedAt: "2026-10-05T00:00:00.000Z",
  httpStatus: 200,
  truncated: false,
};
beforeAll(async () => {
  await client.exec(`
 create function uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
 create table artists(id uuid primary key);
 create table users(id uuid primary key,is_admin boolean,privy_user_id text);
 create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text,reference_code text,created_at timestamptz,updated_at timestamptz);
 create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
 create table artist_vault_sources(id uuid primary key default gen_random_uuid(),artist_id uuid,url text,status text default 'pending',file_path text,extracted_text text,updated_at timestamptz default now(),created_at timestamptz default now(),origin text default 'unknown',activity_id uuid,title text,snippet text,type text,og_image text,podcast_episode_key text,podcast_show_title text,podcast_episode_title text,published_at date,unique(artist_id,url));
 create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text check(kind in ('source_extract','lore_refresh')),status text default 'pending',cursor integer default 0,total integer,claimed_at timestamptz,attempts integer default 0,last_error text,state jsonb,activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
 create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
 create unique index auto_jobs on artist_research_jobs(artist_id,(state->>'autoSourceId')) where kind='source_extract' and state->>'version'='2' and status in ('queued','pending','running');
 insert into artists values('${artist}');insert into users values('${owner}',false,null),('${contributor}',false,null);
 `);
}, 30000);
beforeEach(async () => {
  fetch.mockReset().mockResolvedValue(fetched);
  await client.exec(`delete from artist_research_jobs;delete from artist_activity_events;delete from artist_claims;delete from artist_vault_sources;
  insert into artist_claims(id,artist_id,user_id,status)values('${claim}','${artist}','${owner}','approved');
  insert into artist_vault_sources(id,artist_id,url,status) values('${source}','${artist}','https://artist.example/interview','approved');`);
});
afterAll(async () => client.close());
async function enqueue(activityId: string | null = null) {
  await database.transaction(async raw => {
    const tx = raw as Parameters<typeof queueApprovedSourceExtraction>[0];
    await tx.execute(sql`select id from artists where id=${artist}::uuid for update`);
    await queueApprovedSourceExtraction(tx, row, activityId);
  });
}
async function claimJob() {
  const { rows } = await client.query<Record<string, unknown>>(
    "update artist_research_jobs set status='running',updated_at=now() where status='queued' returning *,updated_at::text as exact_updated",
  );
  return toResearchJob({ ...rows[0], updated_at: rows[0].exact_updated });
}
it("keeps trusted contributor attribution and fetches without impersonating them as owner", async () => {
  const { rows } = await client.query<{ id: string }>(
    "insert into artist_activity_events(artist_id,actor_user_id,actor_kind,action,trigger) values($1,$2,'user','source_submission','trusted') returning id",
    [artist, contributor],
  );
  await enqueue(rows[0].id);
  const job = await claimJob();
  expect(job.state).toEqual({
    version: 2,
    autoSourceId: source,
    expectedClaimId: claim,
    sources: [{ id: source, url: row.url }],
    outcomes: [],
  });
  expect(job.activityId).toBe(rows[0].id);
  await runSourceExtraction(job, Date.now() + 30_000);
  expect(fetch).toHaveBeenCalledOnce();
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: fetched.text },
  ]);
  expect((await client.query("select actor_user_id from artist_activity_events")).rows).toEqual([
    { actor_user_id: contributor },
  ]);
});
it("does not drop distinct sources or duplicate the same live source", async () => {
  await enqueue();
  await enqueue();
  await database.transaction(async raw => {
    const tx = raw as Parameters<typeof queueApprovedSourceExtraction>[0];
    await tx.execute(sql`select id from artists where id=${artist}::uuid for update`);
    await queueApprovedSourceExtraction(
      tx,
      { ...row, id: contributor, url: "https://artist.example/another" },
      null,
    );
  });
  expect(
    (await client.query("select count(*)::int as count from artist_research_jobs")).rows,
  ).toEqual([{ count: 2 }]);
});
it("cancels stale generation jobs and queues the replacement under the new generation", async () => {
  await enqueue();
  await client.query("update artist_claims set id=$1", [contributor]);
  await enqueue();
  expect(
    (
      await client.query(
        "select status,state->>'expectedClaimId' as claim from artist_research_jobs order by created_at",
      )
    ).rows,
  ).toEqual([
    { status: "done", claim },
    { status: "queued", claim: contributor },
  ]);
});
it.each([
  ["rejected", "update artist_vault_sources set status='rejected'"],
  ["replaced", "update artist_vault_sources set url='https://changed.example/article'"],
  ["removed", "delete from artist_vault_sources"],
  [
    "already read",
    "update artist_vault_sources set extracted_text='Original previously recovered'",
  ],
  ["private upload", "update artist_vault_sources set file_path='private/file.pdf'"],
])("skips a source %s before the fetch", async (_reason, change) => {
  await enqueue();
  const job = await claimJob();
  await client.exec(change);
  await runSourceExtraction(job, Date.now() + 30_000);
  expect(fetch).not.toHaveBeenCalled();
  expect(
    (
      await client.query(
        "select status,state->'outcomes'->0->>'status' as outcome from artist_research_jobs",
      )
    ).rows,
  ).toEqual([{ status: "done", outcome: "skipped" }]);
});
it("rechecks source eligibility for blocked fetches as well as successful fetches", async () => {
  await enqueue();
  const job = await claimJob();
  fetch.mockImplementationOnce(async () => {
    await client.query("update artist_vault_sources set status='rejected'");
    return { ...fetched, status: "blocked", text: undefined };
  });
  await runSourceExtraction(job, Date.now() + 30_000);
  expect(
    (
      await client.query(
        "select state->'outcomes'->0->>'status' as outcome from artist_research_jobs",
      )
    ).rows,
  ).toEqual([{ outcome: "skipped" }]);
});
it("does not fetch or write from a stale lease after another worker reclaimed the job", async () => {
  await enqueue();
  const job = await claimJob();
  await client.query("update artist_research_jobs set updated_at=updated_at+interval '1 second'");
  expect(await runSourceExtraction(job, Date.now() + 30_000)).toMatchObject({ waiting: true });
  expect(fetch).not.toHaveBeenCalled();
  expect(
    await checkpointSourceExtraction(job, sourceExtractionSchemas.state.parse(job.state), fetched),
  ).toMatchObject({ waiting: true });
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: null },
  ]);
});
it.each([false, true])(
  "rejects ownership changes before fetch or during fetch (during=%s)",
  async during => {
    await enqueue();
    const job = await claimJob();
    const revoke = () => client.query("update artist_claims set status='revoked'");
    if (during)
      fetch.mockImplementationOnce(async () => {
        await revoke();
        return fetched;
      });
    else await revoke();
    await expect(runSourceExtraction(job, Date.now() + 30_000)).rejects.toBeInstanceOf(
      OwnershipChangedError,
    );
    expect(fetch).toHaveBeenCalledTimes(during ? 1 : 0);
    expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
      { extracted_text: null },
    ]);
  },
);
it("atomically rolls back text if automatic checkpoint persistence fails", async () => {
  await enqueue();
  const job = await claimJob();
  await client.exec(
    "alter table artist_research_jobs add constraint reject_progress check(cursor=0)",
  );
  try {
    await expect(runSourceExtraction(job, Date.now() + 30_000)).rejects.toThrow(
      "persistence unavailable",
    );
    expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
      { extracted_text: null },
    ]);
    expect((await client.query("select cursor from artist_research_jobs")).rows).toEqual([
      { cursor: 0 },
    ]);
  } finally {
    await client.exec("alter table artist_research_jobs drop constraint reject_progress");
  }
});
it("adds an approved source and its job atomically, then queues approval for a pending source", async () => {
  await withArtistOperation(artist, { userId: owner, expectedClaimId: claim }, async () => {
    await insertVaultSource({
      artistId: artist,
      url: "https://artist.example/added",
      status: "approved",
    });
    const pending = await insertVaultSource({
      artistId: artist,
      url: "https://artist.example/pending",
    });
    expect(
      (await client.query("select count(*)::int as count from artist_research_jobs")).rows,
    ).toEqual([{ count: 1 }]);
    await updateVaultSourceStatus(pending!.id, "approved");
  });
  expect(
    (await client.query("select count(*)::int as count from artist_research_jobs")).rows,
  ).toEqual([{ count: 2 }]);
});
it("rolls back an approval and its activity if queueing fails, including outside operation scope", async () => {
  await client.query("update artist_vault_sources set status='pending'");
  await client.exec("alter table artist_research_jobs add constraint no_jobs check(false)");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(updateVaultSourceStatus(source, "approved")).rejects.toThrow();
    expect((await client.query("select status from artist_vault_sources")).rows).toEqual([
      { status: "pending" },
    ]);
    expect(
      (await client.query("select count(*)::int as count from artist_activity_events")).rows,
    ).toEqual([{ count: 0 }]);
  } finally {
    error.mockRestore();
    await client.exec("alter table artist_research_jobs drop constraint no_jobs");
  }
});
it("rejects automatic state that names a different source", () => {
  expect(
    sourceExtractionSchemas.state.safeParse({
      version: 2,
      autoSourceId: source,
      expectedClaimId: claim,
      sources: [{ id: contributor, url: row.url }],
      outcomes: [],
    }).success,
  ).toBe(false);
});

it("treats whitespace-only placeholders as missing and does not lose existing originals", async () => {
  await client.query("update artist_vault_sources set extracted_text=$1", [" \t\r\n"]);
  await enqueue();
  const job = await claimJob();
  await runSourceExtraction(job, Date.now() + 30_000);
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: fetched.text },
  ]);
});
it("rolls back a newly approved source and activity if durable queueing fails", async () => {
  await client.exec("alter table artist_research_jobs add constraint no_jobs check(false)");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(
      insertVaultSource({
        artistId: artist,
        url: "https://artist.example/rollback",
        status: "approved",
      }),
    ).rejects.toThrow("Source extraction queue unavailable");
    expect(
      (await client.query("select count(*)::int as count from artist_vault_sources")).rows,
    ).toEqual([{ count: 1 }]);
    expect(
      (await client.query("select count(*)::int as count from artist_activity_events")).rows,
    ).toEqual([{ count: 0 }]);
  } finally {
    error.mockRestore();
    await client.exec("alter table artist_research_jobs drop constraint no_jobs");
  }
});

it("claims queued originals one at a time while retaining the other artist-source backlog", async () => {
  await enqueue();
  await database.transaction(async raw => {
    const tx = raw as Parameters<typeof queueApprovedSourceExtraction>[0];
    await tx.execute(sql`select id from artists where id=${artist}::uuid for update`);
    await queueApprovedSourceExtraction(
      tx,
      { ...row, id: contributor, url: "https://artist.example/second" },
      null,
    );
  });
  const first = await claimResearchJob({ kinds: ["source_extract"], artistId: artist });
  expect(first?.status).toBe("running");
  expect(await claimResearchJob({ kinds: ["source_extract"], artistId: artist })).toBeNull();
  expect(
    (await client.query("select status from artist_research_jobs order by status")).rows,
  ).toEqual([{ status: "queued" }, { status: "running" }]);
  await client.query("update artist_research_jobs set status='done' where id=$1", [first!.id]);
  const second = await claimResearchJob({ kinds: ["source_extract"], artistId: artist });
  expect(second?.status).toBe("running");
  expect(second?.id).not.toBe(first?.id);
});
it("does not claim queued work for unsupported kinds or around a live explicit extraction", async () => {
  await enqueue();
  expect(await claimResearchJob({ kinds: ["lore_refresh"] })).toBeNull();
  await client.query(
    "insert into artist_research_jobs(artist_id,kind,status,state,claimed_at) values($1,'source_extract','running','{}',now())",
    [artist],
  );
  expect(await claimResearchJob({ kinds: ["source_extract"], artistId: artist })).toBeNull();
  expect(
    (
      await client.query(
        "select count(*)::int as count from artist_research_jobs where status='queued'",
      )
    ).rows,
  ).toEqual([{ count: 1 }]);
});
it("preserves the scheduler's exact database lease timestamp through the worker checkpoint", async () => {
  await enqueue();
  const job = await claimResearchJob({ kinds: ["source_extract"], artistId: artist });
  expect(job).not.toBeNull();
  expect(await runSourceExtraction(job!, Date.now() + 30_000)).toMatchObject({ done: true });
  expect(fetch).toHaveBeenCalledOnce();
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: fetched.text },
  ]);
});
it("does not restart a finished blocked extraction when the same approval is replayed", async () => {
  await client.query("update artist_vault_sources set status='pending'");
  await updateVaultSourceStatus(source, "approved");
  const job = await claimJob();
  fetch.mockResolvedValueOnce({ ...fetched, status: "blocked", text: undefined, httpStatus: 403 });
  await runSourceExtraction(job, Date.now() + 30_000);
  expect(await updateVaultSourceStatus(source, "approved")).toBeUndefined();
  expect(
    (
      await client.query(
        "select status,state->'outcomes'->0->>'status' as outcome from artist_research_jobs",
      )
    ).rows,
  ).toEqual([{ status: "done", outcome: "blocked" }]);
  expect(
    (await client.query("select count(*)::int as count from artist_activity_events")).rows,
  ).toEqual([{ count: 1 }]);
});
