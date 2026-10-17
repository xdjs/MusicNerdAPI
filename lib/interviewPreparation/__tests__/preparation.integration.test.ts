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
    `delete from artist_interview_question_evidence;delete from artist_interview_sessions;delete from artist_research_jobs;delete from artist_interview_answers;delete from artist_doc_corrections;delete from artist_interview_boundaries;delete from artist_claims;delete from artist_activity_events;insert into artist_claims values('${requestId}','${artist}','${user}','approved');insert into artist_interview_answers(id,artist_id,question_key,question,answer,source,sitting)values('${prior}','${artist}','first','What shaped the sound?',' I did not intend that sound. 🥁 ','interview',1);`,
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
it("retains a complete bank across answer save and consumes concurrently only once", async () => {
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
  expect(rows.rows[0].state).toMatchObject({ ordinal: 2, stage: "preparing" });
  expect(rows.rows[0].state.bank.map(item => item.status)).toEqual([
    "offered",
    "available",
    "available",
  ]);
  expect((await getInterviewPreparation(artist, user, session!.id)).preparation).toMatchObject({
    status: "pending",
    readyCount: 0,
    totalCount: 3,
  });
});
