import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queueQuestionResearch } from "../queueQuestionResearch";
import { checkpointQuestionResearch } from "../checkpointQuestionResearch";
import { getQuestionResearchBudget } from "../getQuestionResearchBudget";
import type { ResearchJob } from "@/lib/research/types";
import type { QuestionResearchState } from "../types";
import { researchRequestKey } from "../researchRequestKey";
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: vi.fn() }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({ authorizeArtistKnowledge: vi.fn() }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({
  recordArtistActivity: vi.fn().mockResolvedValue("33333333-3333-4333-8333-333333333333"),
}));
const client = new PGlite();
const driver = drizzle(client);
const artist = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const request = {
  topic: "known song credits",
  evidenceNeed: "credits",
  freshness: "stored",
} as const;
beforeAll(async () => {
  await client.exec(`create table artists(id uuid primary key); insert into artists values('${artist}'),('${other}');
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,state jsonb,status text default 'pending',activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),claimed_at timestamptz,attempts integer default 0,last_error text);`);
  mocks.transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(async tx =>
      fn({
        execute: async (query: Parameters<typeof tx.execute>[0]) => (await tx.execute(query)).rows,
      }),
    ),
  );
}, 30000);
beforeEach(async () => {
  await client.exec("delete from artist_research_jobs");
});
afterAll(async () => client.close());
async function seed(n: number, savedOnly = false, id = artist) {
  await client.query(
    `insert into artist_research_jobs(artist_id,kind,status,state) select $1::uuid,'question_research','done',$2::jsonb from generate_series(1,$3::int)`,
    [
      id,
      JSON.stringify({ savedOnly, stage: "complete", key: "different", expectedClaimId: null }),
      n,
    ],
  );
}
it("admits more than five saved questions for one artist without consuming outside slots", async () => {
  await seed(5);
  for (let i = 0; i < 6; i++) {
    const queued = await queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: `saved question ${i}` },
    );
    expect(queued).not.toHaveProperty("outsideResearchReason");
    const { rows } = await client.query<{ state: QuestionResearchState }>(
      "select state from artist_research_jobs where id=$1",
      [queued.jobId],
    );
    expect(rows[0].state).toMatchObject({ budgetVersion: 2 });
    expect(rows[0].state.outsideReservedAt).toBeUndefined();
    await client.query("update artist_research_jobs set status='done' where id=$1", [queued.jobId]);
  }
  const budget = await getQuestionResearchBudget(
    {
      execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
    } as never,
    artist,
  );
  expect(budget.saved).toBeNull();
  expect(budget.outside?.quotaScope).toBe("outside_artist");
});
it("does not count saved-only jobs as additional outside collection allowance or usage", async () => {
  await seed(5, true);
  const result = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(result).not.toHaveProperty("outsideResearchReason");
  const { rows } = await client.query<{ state: { savedOnly?: boolean } }>(
    "select state from artist_research_jobs where id=$1::uuid",
    [result.jobId],
  );
  expect(rows[0].state.savedOnly).toBeUndefined();
});
it("finds an exact reusable job behind more than ten unrelated newer rows", async () => {
  const key = researchRequestKey(request);
  const { rows } = await client.query<{ id: string }>(
    `insert into artist_research_jobs(artist_id,kind,status,state,created_at) values($1::uuid,'question_research','done',$2::jsonb,now()-interval '10 minutes') returning id`,
    [artist, JSON.stringify({ key, stage: "complete", expectedClaimId: null })],
  );
  await seed(12);
  const result = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(result).toMatchObject({ jobId: rows[0].id, reused: true });
});
it("admits at most one concurrent job when only one saved global slot remains", async () => {
  await seed(100, false, other);
  await seed(99, true, "44444444-4444-4444-8444-444444444444");
  const outcomes = await Promise.allSettled([
    queueQuestionResearch(artist, { kind: "service" }, request),
    queueQuestionResearch(
      other,
      { kind: "service" },
      { ...request, topic: "another exact credit" },
    ),
  ]);
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.find(r => r.status === "rejected")).toMatchObject({
    reason: { code: "saved_evidence_quota" },
  });
  const { rows } = await client.query<{ n: number }>(
    "select count(*)::int n from artist_research_jobs where state->>'budgetVersion'='2' or state->'savedOnly'='true'::jsonb",
  );
  expect(rows[0].n).toBe(100);
});

async function running(id: string): Promise<ResearchJob> {
  const { rows } = await client.query<{
    id: string;
    artist_id: string;
    state: QuestionResearchState;
    updated_at: string;
  }>(
    "update artist_research_jobs set status='running',updated_at=clock_timestamp() where id=$1 returning id,artist_id,state,updated_at::text",
    [id],
  );
  const r = rows[0];
  return {
    id: r.id,
    artistId: r.artist_id,
    state: r.state as unknown as Record<string, unknown>,
    updatedAt: r.updated_at,
    status: "running",
    kind: "question_research",
    cursor: 0,
    total: null,
    attempts: 0,
    activityId: null,
  };
}
function external(job: ResearchJob): QuestionResearchState {
  return {
    ...job.state,
    step: "search",
    stage: "searching",
    plan: {
      provider: "web",
      stage: "searching",
      query: "artist credits",
      reason: "work_specific_originals",
    },
  } as QuestionResearchState;
}
it("reserves outside only at transition, idempotently for the same job", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request);
  const job = await running(queued.jobId);
  const state = external(job);
  expect(await checkpointQuestionResearch(job, state, false, undefined, true)).toBe(true);
  const stamp = state.outsideReservedAt;
  expect(stamp).toBeTruthy();
  expect(await checkpointQuestionResearch(job, state, false, undefined, true)).toBe(true);
  expect(state.outsideReservedAt).toBe(stamp);
  const { rows } = await client.query<{ n: number }>(
    "select count(*)::int n from artist_research_jobs where state->>'outsideReservedAt' is not null",
  );
  expect(rows[0].n).toBe(1);
});
it("does not reserve or alter accounting after a stale lease", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request);
  const job = await running(queued.jobId);
  await client.query(
    "update artist_research_jobs set updated_at=updated_at+interval '1 second' where id=$1",
    [job.id],
  );
  expect(await checkpointQuestionResearch(job, external(job), false, undefined, true)).toBe(false);
  const { rows } = await client.query<{ state: QuestionResearchState }>(
    "select state from artist_research_jobs where id=$1",
    [job.id],
  );
  expect(rows[0].state.outsideReservedAt).toBeUndefined();
});
it("reserves at most one outside slot across concurrent artists at the global boundary", async () => {
  await seed(99, false, "44444444-4444-4444-8444-444444444444");
  const a = await queueQuestionResearch(artist, { kind: "service" }, request);
  const b = await queueQuestionResearch(other, { kind: "service" }, request);
  const jobs = await Promise.all([running(a.jobId), running(b.jobId)]);
  const outcomes = await Promise.allSettled(
    jobs.map(j => checkpointQuestionResearch(j, external(j), false, undefined, true)),
  );
  expect(outcomes.filter(o => o.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.find(o => o.status === "rejected")).toMatchObject({
    reason: {
      code: "outside_research_quota",
      quota: {
        quotaScope: "outside_global",
        retryAfterSeconds: expect.any(Number),
        resetAt: expect.any(String),
      },
    },
  });
  const { rows } = await client.query<{ n: number }>(
    "select count(*)::int n from artist_research_jobs where state->>'outsideReservedAt' is not null",
  );
  expect(rows[0].n).toBe(1);
});
it("reports the rolling boundary that actually frees capacity, including over-limit history", async () => {
  await seed(101, true);
  await client.exec("update artist_research_jobs set created_at=now()-interval '23 hours'");
  await client.exec(
    "update artist_research_jobs set created_at=now()-interval '23 hours 30 minutes' where id=(select id from artist_research_jobs limit 1)",
  );
  await expect(queueQuestionResearch(artist, { kind: "service" }, request)).rejects.toMatchObject({
    code: "saved_evidence_quota",
    quota: { quotaScope: "saved_global", retryAfterSeconds: 3600, resetAt: expect.any(String) },
  });
});

it("reuses a quota-blocked job only until its outside reset, then admits a new question without deleting history", async () => {
  const first = await queueQuestionResearch(artist, { kind: "service" }, request);
  await client.query(
    "update artist_research_jobs set status='done',state=state || $2::jsonb where id=$1",
    [
      first.jobId,
      JSON.stringify({
        stage: "unresolved",
        step: "saved",
        savedOnly: true,
        outsideQuota: {
          quotaScope: "outside_artist",
          retryAfterSeconds: 600,
          resetAt: new Date(Date.now() + 600000).toISOString(),
        },
      }),
    ],
  );
  expect(await queueQuestionResearch(artist, { kind: "service" }, request)).toMatchObject({
    jobId: first.jobId,
    reused: true,
  });
  await client.query(
    "update artist_research_jobs set state=jsonb_set(state,'{outsideQuota,resetAt}',to_jsonb((now()-interval '1 second')::text)) where id=$1",
    [first.jobId],
  );
  const next = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(next.reused).toBe(false);
  expect(next.jobId).not.toBe(first.jobId);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows[0]).toEqual({
    n: 2,
  });
});
