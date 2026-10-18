import { PGlite } from "@electric-sql/pglite";
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

const { startInterviewSession } = await import("@/lib/interviewSessions/startInterviewSession");
const { getInterviewSession } = await import("@/lib/interviewSessions/getInterviewSession");
const { saveInterviewAnswer } = await import("@/lib/interviewSessions/saveInterviewAnswer");
const { finishInterviewSession } = await import("@/lib/interviewSessions/finishInterviewSession");
const { loadInterviewMemory } = await import("@/lib/interviewMemory/loadInterviewMemory");
const { pageInterviewMemory } = await import("@/lib/interviewMemory/pageInterviewMemory");
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  prior = "00000000-0000-4000-8000-000000000003",
  requestId = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  await client.exec(`
create table artists(id uuid primary key,name text,bio text);
create table users(id uuid primary key,is_admin boolean);
create table artist_vault_sources(id uuid primary key default gen_random_uuid(),artist_id uuid,status text,extracted_text text);
create table artist_social_posts(id uuid primary key default gen_random_uuid(),artist_id uuid,is_own_post boolean,caption text);
create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text);
create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
create table artist_interview_answers(id uuid primary key default gen_random_uuid(),artist_id uuid,question_key text,question text,answer text,source text,sitting int,offered_at timestamptz default now(),created_at timestamptz default now(),unique(artist_id,question_key));
create table artist_doc_corrections(id uuid primary key default gen_random_uuid(),artist_id uuid,claim text,correction text,kind text,created_at timestamptz default now(),updated_at timestamptz default now());
create table artist_interview_boundaries(id uuid primary key default gen_random_uuid(),artist_id uuid,request_id uuid,wording text,scope text,sitting int,origin_answer_id uuid,origin_question_key text,origin_question text,created_by uuid,activity_id uuid,created_at timestamptz default now(),retracted_at timestamptz,retracted_by uuid,retraction_activity_id uuid,unique(artist_id,request_id));
create table artist_interview_sessions(id uuid primary key default gen_random_uuid(),artist_id uuid,request_id uuid,sitting int,state text default 'active',created_by uuid,created_at timestamptz default now(),closed_at timestamptz,unique(artist_id,request_id),unique(artist_id,sitting));
create unique index one_active_session on artist_interview_sessions(artist_id) where state='active';
create table artist_interview_question_evidence(answer_id uuid primary key,artist_id uuid,session_id uuid,ordinal int,memory_snapshot_id text,evidence_references jsonb,created_at timestamptz default now(),unique(session_id,ordinal));
create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',state jsonb,claimed_at timestamptz,last_error text,activity_id uuid,attempts int default 0,created_at timestamptz default now(),updated_at timestamptz default now());
create unique index one_active_job on artist_research_jobs(artist_id,kind) where status in ('pending','running');
insert into artists values('${artist}','Artist',null);insert into users values('${user}',false);`);
}, 30000);
beforeEach(async () => {
  await client.exec(
    `delete from artist_vault_sources;delete from artist_social_posts;delete from artist_interview_question_evidence;delete from artist_interview_sessions;delete from artist_research_jobs;delete from artist_interview_answers;delete from artist_doc_corrections;delete from artist_interview_boundaries;delete from artist_claims;delete from artist_activity_events;insert into artist_claims values('${requestId}','${artist}','${user}','approved');insert into artist_interview_answers(id,artist_id,question_key,question,answer,source,sitting)values('${prior}','${artist}','first','What shaped the sound?',' I did not intend that sound. 🥁 ','interview',1);`,
  );
});
afterAll(async () => client.close());
async function offerInput(sitting: number) {
  const memory = await loadInterviewMemory(artist, user, sitting);
  const latest = memory.entries.find(e => e.kind === "latest_answer")!;
  const answer = latest.fields.find(f => f.name === "answer")!.text!;
  return {
    ordinal: 1,
    memorySnapshotId: pageInterviewMemory(memory, { maxChars: 20000 }).snapshotId,
    question: "What do you think led to that sound?",
    references: [
      {
        kind: "answer",
        entryId: latest.entryId,
        revision: latest.revision,
        start: 0,
        end: answer.length,
        quote: answer,
      },
    ],
  };
}

const { queueInterviewPreparationInTransaction } =
  await import("../queueInterviewPreparationInTransaction");
const { getInterviewPreparation } = await import("../getInterviewPreparation");
const { consumeInterviewPreparation } = await import("../consumeInterviewPreparation");
const queue = (sessionId: string) =>
  database.transaction(tx =>
    queueInterviewPreparationInTransaction(tx as never, artist, user, sessionId),
  ) as ReturnType<typeof queueInterviewPreparationInTransaction>;
async function readyCandidate(sessionId: string, jobId: string) {
  const input = await offerInput(2);
  await client.query(
    "update artist_research_jobs set status='done',state=jsonb_set(jsonb_set(state,'{stage}','\"ready\"'),'{candidate}',$1::jsonb) where id=$2",
    [JSON.stringify(input), jobId],
  );
}
it("deduplicates simultaneous preparation and makes reads mutation-free", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  expect(await getInterviewPreparation(artist, user, session!.id)).toEqual({
    status: "ok",
    preparation: { status: "idle" },
  });
  const [a, b] = await Promise.all([queue(session!.id), queue(session!.id)]);
  expect(a.preparation.jobId).toBe(b.preparation.jobId);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
  expect((await getInterviewSession(artist, user)).session!.questions).toEqual([]);
  await getInterviewPreparation(artist, user, session!.id);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
});
it("consumes a ready candidate once and automatically queues after an exact saved answer", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  await readyCandidate(session!.id, queued.preparation.jobId);
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation.status).toBe(
    "ready",
  );
  const [a, b] = await Promise.all([
    consumeInterviewPreparation(artist, user, session!.id),
    consumeInterviewPreparation(artist, user, session!.id),
  ]);
  expect(a.question.id).toBe(b.question.id);
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation.status).toBe(
    "idle",
  );
  await saveInterviewAnswer(artist, user, a.question.id, {
    expectedRevision: a.question.revision,
    answer: "  My exact words 🥁\n",
  });
  const next = await getInterviewPreparation(artist, user, session!.id);
  expect(next.preparation.status).toBe("pending");
  const rows = await client.query("select state from artist_research_jobs where status='pending'");
  expect((rows.rows[0] as { state: { ordinal: number } }).state.ordinal).toBe(2);
  expect((await getInterviewSession(artist, user)).session!.questions[0].answer).toBe(
    "  My exact words 🥁\n",
  );
});
it("marks changed memory stale without writing and refuses consumption", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  await readyCandidate(session!.id, queued.preparation.jobId);
  await client.exec(
    "update artist_interview_answers set answer='Changed exact context' where id='" + prior + "'",
  );
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation.status).toBe(
    "stale",
  );
  await expect(consumeInterviewPreparation(artist, user, session!.id)).rejects.toMatchObject({
    code: "preparation_stale",
  });
  expect((await getInterviewSession(artist, user)).session!.questions).toEqual([]);
  const next = await queue(session!.id);
  expect(next.preparation.jobId).not.toBe(queued.preparation.jobId);
});
it("denies admin-only and revoked claim preparation", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  await queue(session!.id);
  await client.exec("delete from artist_claims;update users set is_admin=true");
  await expect(getInterviewPreparation(artist, user, session!.id)).rejects.toMatchObject({
    status: 403,
  });
  await expect(queue(session!.id)).rejects.toMatchObject({ status: 403 });
  await client.exec("update users set is_admin=false");
});
it("will not prepare for a finished sitting", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  await queue(session!.id);
  await finishInterviewSession(artist, user, session!.id);
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation.status).toBe(
    "stale",
  );
  await expect(queue(session!.id)).rejects.toMatchObject({ status: 409 });
});
it("offers the complete bank atomically and saves answers without preparation", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  const input = await offerInput(2);
  const bank = [0, 1, 2].map(index => ({
    status: "available",
    candidate: {
      ...input,
      question: `What distinct creative choice number ${index + 1} surprised you?`,
    },
  }));
  await client.query(
    "update artist_research_jobs set status='done',state=state || $1::jsonb where id=$2",
    [
      JSON.stringify({ stage: "ready", bankComplete: true, bank, totalCount: 3 }),
      queued.preparation.jobId,
    ],
  );
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation).toMatchObject({
    status: "ready",
    readyCount: 3,
    totalCount: 3,
  });
  const [a, b] = await Promise.all([
    consumeInterviewPreparation(artist, user, session!.id),
    consumeInterviewPreparation(artist, user, session!.id),
  ]);
  expect(a.question.id).toBe(b.question.id);
  await saveInterviewAnswer(artist, user, a.question.id, {
    expectedRevision: a.question.revision,
    answer: "My exact new experience.",
  });
  const rows = await client.query<{
    state: { bank: Array<{ status: string }>; ordinal: number; stage: string };
  }>("select state from artist_research_jobs");
  expect(rows.rows).toHaveLength(1);
  expect(rows.rows[0].state).toMatchObject({ ordinal: 1, stage: "consumed" });
  expect(rows.rows[0].state.bank.map(item => item.status)).toEqual([
    "offered",
    "offered",
    "offered",
  ]);
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation).toMatchObject({
    status: "idle",
  });
});

it("retries failed eligibility against the retained bank without replacing the job", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  const input = await offerInput(2);
  await client.query(
    "update artist_research_jobs set status='failed',state=state || $1::jsonb where id=$2",
    [
      JSON.stringify({
        stage: "failed",
        bankComplete: true,
        bank: [{ status: "available", candidate: input }],
        totalCount: 3,
      }),
      queued.preparation.jobId,
    ],
  );
  const retried = await queue(session!.id);
  expect(retried.preparation).toMatchObject({
    jobId: queued.preparation.jobId,
    status: "pending",
    phase: "checking",
  });
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
});
it("stops a fixed bank after a new boundary while preserving saved answers and idempotent replay", async () => {
  const { saveInterviewBoundary } = await import("@/lib/interviewMemory/saveInterviewBoundary");
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  const input = await offerInput(2);
  const bank = [0, 1, 2].map(index => ({
    status: "available",
    candidate: { ...input, question: `Which creative choice ${index} changed your process?` },
  }));
  await client.query(
    "update artist_research_jobs set status='done',state=state || $1::jsonb where id=$2",
    [
      JSON.stringify({ stage: "ready", bankComplete: true, bank, totalCount: 3 }),
      queued.preparation.jobId,
    ],
  );
  const offered = await consumeInterviewPreparation(artist, user, session!.id);
  expect(offered.questions).toHaveLength(3);
  expect(new Set(offered.questions.map(q => q.offeredAt)).size).toBe(1);
  const first = offered.questions[0],
    second = offered.questions[1];
  await saveInterviewAnswer(artist, user, first.id, {
    expectedRevision: first.revision,
    answer: "Keep my exact answer.",
  });
  const boundary = await saveInterviewBoundary(artist, user, {
    requestId: "00000000-0000-4000-8000-000000000099",
    questionKey: second.questionKey,
    wording: "Do not ask about collaborations.",
    scope: "sitting",
  });
  expect(boundary.interviewInvalidated).toBe(true);
  expect((await getInterviewSession(artist, user)).session?.interviewInvalidated).toBe(true);
  await expect(
    saveInterviewAnswer(artist, user, second.id, {
      expectedRevision: second.revision,
      answer: "Unsaved",
    }),
  ).rejects.toMatchObject({ code: "interview_invalidated" });
  await expect(
    saveInterviewAnswer(artist, user, first.id, {
      expectedRevision: first.revision,
      answer: "Keep my exact answer.",
    }),
  ).resolves.toMatchObject({ question: { answer: "Keep my exact answer." } });
  expect((await getInterviewSession(artist, user)).session!.questions[1].state).toBe("offered");
});
it("rolls back the entire offered bank if any candidate evidence changed", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  const input = await offerInput(2);
  const bank = [
    { status: "available", candidate: input },
    {
      status: "available",
      candidate: {
        ...input,
        references: input.references.map(r => ({ ...r, revision: "0".repeat(64) })),
      },
    },
  ];
  await client.query(
    "update artist_research_jobs set status='done',state=state || $1::jsonb where id=$2",
    [
      JSON.stringify({ stage: "ready", bankComplete: true, bank, totalCount: 2 }),
      queued.preparation.jobId,
    ],
  );
  await expect(consumeInterviewPreparation(artist, user, session!.id)).rejects.toMatchObject({
    code: "revision_changed",
  });
  expect((await getInterviewSession(artist, user)).session!.questions).toHaveLength(0);
});

async function automaticJob() {
  const state = {
    version: 1,
    mode: "claim_preparation",
    claimId: requestId,
    userId: user,
    createdAt: new Date().toISOString(),
  };
  const rows = await client.query<{ id: string; updated_at: string }>(
    "insert into artist_research_jobs(artist_id,kind,status,state) values($1,'interview_prepare','running',$2::jsonb) returning id,updated_at::text",
    [artist, JSON.stringify(state)],
  );
  return {
    id: rows.rows[0].id,
    updatedAt: rows.rows[0].updated_at,
    artistId: artist,
    kind: "interview_prepare",
    status: "running",
    state,
    cursor: 0,
    total: null,
    attempts: 0,
    activityId: null,
  } as import("@/lib/research/types").ResearchJob;
}
it("automatically prepares privately only when claim research has readable evidence", async () => {
  const { bootstrapClaimInterviewPreparation } =
    await import("../bootstrapClaimInterviewPreparation");
  const waiting = await automaticJob();
  expect(await bootstrapClaimInterviewPreparation(waiting)).toBe(false);
  expect((await getInterviewSession(artist, user)).session).toBeNull();
  const pending = await client.query<{ state: { nextAttemptAtMs: number } }>(
    "select state from artist_research_jobs where id=$1",
    [waiting.id],
  );
  expect(pending.rows[0].state.nextAttemptAtMs).toBeGreaterThan(Date.now());
  await client.query(
    "insert into artist_social_posts(artist_id,is_own_post,caption)values($1,true,$2)",
    [
      artist,
      "An exact artist-owned caption describing the recording process and the concrete creative choices behind this release.",
    ],
  );
  const lease = await client.query<{ updated_at: string }>(
    "update artist_research_jobs set status='running',updated_at=clock_timestamp() where id=$1 returning updated_at::text",
    [waiting.id],
  );
  waiting.updatedAt = lease.rows[0].updated_at;
  expect(await bootstrapClaimInterviewPreparation(waiting)).toBe(true);
  expect(waiting.state).toMatchObject({
    stage: "preparing",
    totalCount: 3,
    claimId: requestId,
    userId: user,
  });
  const restored = await getInterviewSession(artist, user);
  expect(restored.session!.questions).toEqual([]);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
});
it("does not bootstrap a revoked claim", async () => {
  const { bootstrapClaimInterviewPreparation } =
    await import("../bootstrapClaimInterviewPreparation");
  const job = await automaticJob();
  await client.exec("delete from artist_claims");
  expect(await bootstrapClaimInterviewPreparation(job)).toBe(false);
  expect(
    (await client.query("select count(*)::int n from artist_interview_sessions")).rows,
  ).toEqual([{ n: 0 }]);
});
it("manual preparation adopts the same pending automatic claim job", async () => {
  const job = await automaticJob();
  const { session } = await startInterviewSession(artist, user, { requestId });
  const prepared = await queue(session!.id);
  expect(prepared.preparation.jobId).toBe(job.id);
  const { bootstrapClaimInterviewPreparation } =
    await import("../bootstrapClaimInterviewPreparation");
  expect(await bootstrapClaimInterviewPreparation(job)).toBe(false);
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
});

it("prepares with readable artist context despite unrelated ongoing research", async () => {
  const { bootstrapClaimInterviewPreparation } =
    await import("../bootstrapClaimInterviewPreparation");
  const job = await automaticJob();
  await client.query(
    "insert into artist_social_posts(artist_id,is_own_post,caption)values($1,true,$2)",
    [
      artist,
      "An exact artist-owned caption describing the recording process and the concrete creative choices behind this release.",
    ],
  );
  await client.query(
    "insert into artist_research_jobs(artist_id,kind,status,state)values($1,'source_search','pending','{}')",
    [artist],
  );
  expect(await bootstrapClaimInterviewPreparation(job)).toBe(true);
  expect((await getInterviewSession(artist, user)).session?.questions).toEqual([]);
});
it("stops empty automatic preparation after24h and reclaims the same job only when evidence becomes usable", async () => {
  const { bootstrapClaimInterviewPreparation } =
    await import("../bootstrapClaimInterviewPreparation");
  const { claimResearchJob } = await import("@/lib/research/claimResearchJob");
  const job = await automaticJob();
  job.state.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await client.query("update artist_research_jobs set state=$1::jsonb where id=$2", [
    JSON.stringify(job.state),
    job.id,
  ]);
  expect(await bootstrapClaimInterviewPreparation(job)).toBe(false);
  expect(job.state.stoppedReason).toBe("claim_preparation_no_readable_originals");
  expect(await claimResearchJob({ kinds: ["interview_prepare"], artistId: artist })).toBeNull();
  await client.query(
    "insert into artist_vault_sources(artist_id,status,extracted_text)values($1,'pending',$2)",
    [
      artist,
      "A readable original describing actual recording methods and the musical choices behind the artist releases.",
    ],
  );
  expect(await claimResearchJob({ kinds: ["interview_prepare"], artistId: artist })).toBeNull();
  await client.query("update artist_vault_sources set status='approved' where artist_id=$1", [
    artist,
  ]);
  const resumed = await claimResearchJob({ kinds: ["interview_prepare"], artistId: artist });
  expect(resumed?.id).toBe(job.id);
  expect(await bootstrapClaimInterviewPreparation(resumed!)).toBe(true);
  expect((await getInterviewSession(artist, user)).session!.questions).toHaveLength(0);
});

it("explicit Resume upgrades a legacy offered bank without changing existing offers or answers", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  const input = await offerInput(2);
  const bank = [0, 1, 2].map(index => ({
    status: "available",
    candidate: { ...input, question: `Legacy distinct question ${index + 1}?` },
  }));
  await client.query(
    "update artist_research_jobs set status='done',state=state || $1::jsonb where id=$2",
    [
      JSON.stringify({ stage: "ready", bankComplete: false, bank, totalCount: 3 }),
      queued.preparation.jobId,
    ],
  );
  const original = await consumeInterviewPreparation(artist, user, session!.id);
  expect(original.questions).toHaveLength(1);
  await client.query("update artist_research_jobs set state=state || $1::jsonb where id=$2", [
    JSON.stringify({ bankComplete: true, batchOffered: false }),
    queued.preparation.jobId,
  ]);
  expect((await getInterviewSession(artist, user)).session!.questions).toHaveLength(1);
  expect((await getInterviewSession(artist, user)).session!.needsPreparedBankResume).toBe(true);
  const resumed = await consumeInterviewPreparation(artist, user, session!.id);
  expect(resumed.questions).toHaveLength(3);
  expect((await getInterviewSession(artist, user)).session!.needsPreparedBankResume).toBe(false);
  expect(resumed.question).toEqual(original.question);
  const replay = await consumeInterviewPreparation(artist, user, session!.id);
  expect(replay.questions).toEqual(resumed.questions);
  for (const question of resumed.questions)
    await saveInterviewAnswer(artist, user, question.id, {
      expectedRevision: question.revision,
      answer: `Exact response ${question.ordinal}`,
    });
  const jobs = await client.query<{ state: { stage: string; batchOffered: boolean } }>(
    "select state from artist_research_jobs",
  );
  expect(jobs.rows).toHaveLength(1);
  expect(jobs.rows[0].state).toMatchObject({ stage: "consumed", batchOffered: true });
});
it("does not upgrade a legacy bank after mandatory memory changes", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const queued = await queue(session!.id);
  const input = await offerInput(2);
  const bank = [0, 1, 2].map(index => ({
    status: "available",
    candidate: { ...input, question: `Legacy question ${index + 1}?` },
  }));
  await client.query(
    "update artist_research_jobs set status='done',state=state || $1::jsonb where id=$2",
    [
      JSON.stringify({ stage: "ready", bankComplete: false, bank, totalCount: 3 }),
      queued.preparation.jobId,
    ],
  );
  const original = await consumeInterviewPreparation(artist, user, session!.id);
  await client.query("update artist_research_jobs set state=state || $1::jsonb where id=$2", [
    JSON.stringify({ bankComplete: true, batchOffered: false }),
    queued.preparation.jobId,
  ]);
  await client.query(
    "update artist_interview_answers set answer='Changed exact prior answer' where id=$1",
    [prior],
  );
  const resumed = await consumeInterviewPreparation(artist, user, session!.id);
  expect(resumed.question).toEqual(original.question);
  expect(resumed.questions).toHaveLength(1);
});
