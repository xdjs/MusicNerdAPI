import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { toResearchJob } from "@/lib/research/toResearchJob";
import { sourceExtractionSchemas } from "@/lib/sourceExtraction/sourceExtractionSchemas";
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
const { queueSourceExtraction } = await import("@/lib/sourceExtraction/queueSourceExtraction");
const { checkpointSourceExtraction } =
  await import("@/lib/sourceExtraction/checkpointSourceExtraction");
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  claim = "00000000-0000-4000-8000-000000000003",
  source = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  await client.exec(`
 create table artists(id uuid primary key);
 create table users(id uuid primary key,is_admin boolean);
 create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text,reference_code text,created_at timestamptz,updated_at timestamptz);
 create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
 create table artist_vault_sources(id uuid primary key,artist_id uuid,url text,status text,file_path text,extracted_text text,updated_at timestamptz default now());
 create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text check(kind in ('source_extract')),status text default 'pending',cursor integer default 0,total integer,claimed_at timestamptz,attempts integer default 0,last_error text,state jsonb,activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
 create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
 insert into artists values('${artist}');insert into users values('${user}',false);insert into artist_claims(id,artist_id,user_id,status)values('${claim}','${artist}','${user}','approved');
 insert into artist_vault_sources(id,artist_id,url,status) values('${source}','${artist}','https://artist.example/interview','approved');
 `);
}, 30000);
beforeEach(async () => {
  await client.exec(
    `delete from artist_research_jobs;delete from artist_activity_events;update artist_claims set status='approved';update artist_vault_sources set status='approved',extracted_text=null,url='https://artist.example/interview';`,
  );
});
afterAll(async () => client.close());
async function queued() {
  const r = await withArtistOperation(
    artist,
    { userId: user, expectedClaimId: claim, trigger: "test" },
    () => queueSourceExtraction(artist, [source]),
  );
  const { rows } = await client.query<Record<string, unknown>>(
    "update artist_research_jobs set status='running',updated_at=now() where id=$1 returning *,updated_at::text as exact_updated",
    [r.jobId],
  );
  return toResearchJob({ ...rows[0], updated_at: rows[0].exact_updated });
}
const fetched = {
  status: "ready" as const,
  text: "The artist's exact words.",
  capturedAt: "2026-10-05T00:00:00.000Z",
  httpStatus: 200,
  truncated: false,
};
it("writes and reopens an original with a durable outcome, with no duplicate write on retry", async () => {
  const job = await queued();
  const state = sourceExtractionSchemas.state.parse(job.state);
  await checkpointSourceExtraction(job, state, fetched);
  const { rows } = await client.query<{ extracted_text: string }>(
    "select extracted_text from artist_vault_sources",
  );
  expect(rows[0].extracted_text).toBe(fetched.text);
  expect(
    (
      await client.query(
        "select status,cursor,state->'outcomes' as outcomes from artist_research_jobs",
      )
    ).rows,
  ).toMatchObject([
    {
      status: "done",
      cursor: 1,
      outcomes: [{ status: "ready", storedChars: fetched.text.length }],
    },
  ]);
  expect(await checkpointSourceExtraction(job, state, fetched)).toMatchObject({ waiting: true });
});
it("rolls back the text write if checkpoint persistence fails", async () => {
  const job = await queued();
  await client.exec(
    "alter table artist_research_jobs add constraint reject_progress check(cursor=0)",
  );
  try {
    await expect(
      checkpointSourceExtraction(job, sourceExtractionSchemas.state.parse(job.state), fetched),
    ).rejects.toThrow();
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
it("preserves a source changed while its fetch was running", async () => {
  const job = await queued();
  await client.query("update artist_vault_sources set extracted_text='Newer original'");
  await checkpointSourceExtraction(job, sourceExtractionSchemas.state.parse(job.state), fetched);
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: "Newer original" },
  ]);
  expect(
    (
      await client.query(
        "select state->'outcomes'->0->>'status' as status from artist_research_jobs",
      )
    ).rows,
  ).toEqual([{ status: "skipped" }]);
});
it("cannot write after source approval or artist ownership is revoked", async () => {
  const job = await queued();
  await client.query("update artist_vault_sources set status='rejected'");
  await checkpointSourceExtraction(job, sourceExtractionSchemas.state.parse(job.state), fetched);
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: null },
  ]);
  await client.exec(
    "delete from artist_research_jobs;update artist_vault_sources set status='approved'",
  );
  const next = await queued();
  await client.query("update artist_claims set status='revoked'");
  await expect(
    checkpointSourceExtraction(next, sourceExtractionSchemas.state.parse(next.state), fetched),
  ).rejects.toThrow("ownership changed");
  expect((await client.query("select extracted_text from artist_vault_sources")).rows).toEqual([
    { extracted_text: null },
  ]);
});
