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
const { saveInterviewOffer } = await import("@/lib/interviewSessions/saveInterviewOffer");
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
create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',state jsonb,activity_id uuid,attempts int default 0,created_at timestamptz default now(),updated_at timestamptz default now());
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
it("reads without creating a sitting, starts idempotently and allocates after legacy history", async () => {
  expect(await getInterviewSession(artist, user)).toEqual({
    status: "ok",
    session: null,
    legacyOffers: [],
  });
  const [a, b] = await Promise.all([
    startInterviewSession(artist, user, { requestId }),
    startInterviewSession(artist, user, { requestId }),
  ]);
  expect(a.session?.id).toBe(b.session?.id);
  expect(a.session?.sitting).toBe(2);
  expect(a.session?.questions).toEqual([]);
  await expect(startInterviewSession(artist, user, { requestId: prior })).rejects.toMatchObject({
    status: 409,
  });
});
it("converges simultaneous offers, restores exact evidence and preserves immutable offer timing", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const input = await offerInput(session!.sitting);
  const [a, b] = await Promise.all([
    saveInterviewOffer(artist, user, session!.id, input),
    saveInterviewOffer(artist, user, session!.id, {
      ...input,
      question: "A different concurrent draft?",
    }),
  ]);
  expect(a.question.id).toBe(b.question.id);
  expect(b.question.question).toBe(a.question.question);
  const q = a.question;
  const exact = "  It came from a broken drum machine. 🥁\n  ";
  const saved = await saveInterviewAnswer(artist, user, q.id, {
    expectedRevision: q.revision,
    answer: exact,
  });
  expect(saved.question.answer).toBe(exact);
  expect(saved.question.offeredAt).toBe(q.offeredAt);
  const restored = await getInterviewSession(artist, user);
  expect(restored.session?.questions[0].references).toEqual(input.references);
  expect(restored.session?.questions[0].answer).toBe(exact);
  expect(
    (await loadInterviewMemory(artist, user, session!.sitting)).entries[0].fields.find(
      f => f.name === "answer",
    )?.text,
  ).toBe(exact);
});
it("rejects changed memory, altered quote/revision and stale simultaneous answers", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const input = await offerInput(session!.sitting);
  await expect(
    saveInterviewOffer(artist, user, session!.id, { ...input, memorySnapshotId: "a".repeat(64) }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    saveInterviewOffer(artist, user, session!.id, {
      ...input,
      references: [{ ...input.references[0], quote: "That never happened." }],
    }),
  ).rejects.toMatchObject({ status: 409 });
  const { question: q } = await saveInterviewOffer(artist, user, session!.id, input);
  await saveInterviewAnswer(artist, user, q.id, {
    expectedRevision: q.revision,
    answer: "Exact answer.",
  });
  await expect(
    saveInterviewAnswer(artist, user, q.id, {
      expectedRevision: q.revision,
      answer: "Another tab overwrites it.",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (
      await saveInterviewAnswer(artist, user, q.id, {
        expectedRevision: q.revision,
        answer: "Exact answer.",
      })
    ).question.answer,
  ).toBe("Exact answer.");
});
it("requires a prior answer/skip, bounds offers, and does not infer boundaries from a skip", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const input = await offerInput(session!.sitting);
  const { question: q } = await saveInterviewOffer(artist, user, session!.id, input);
  await expect(
    saveInterviewOffer(artist, user, session!.id, { ...input, ordinal: 2 }),
  ).rejects.toMatchObject({ status: 409 });
  await saveInterviewAnswer(artist, user, q.id, { expectedRevision: q.revision, answer: null });
  await expect(
    saveInterviewOffer(artist, user, session!.id, { ...input, ordinal: 4 }),
  ).rejects.toMatchObject({ status: 400 });
  expect(
    (await loadInterviewMemory(artist, user, session!.sitting)).entries.some(
      e => e.kind === "boundary",
    ),
  ).toBe(false);
});
it("finishes idempotently, queues one durable Lore refresh and permits a fresh sitting", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const { question: q } = await saveInterviewOffer(
    artist,
    user,
    session!.id,
    await offerInput(session!.sitting),
  );
  await saveInterviewAnswer(artist, user, q.id, {
    expectedRevision: q.revision,
    answer: "Exact answer.",
  });
  await finishInterviewSession(artist, user, session!.id);
  await finishInterviewSession(artist, user, session!.id);
  expect((await getInterviewSession(artist, user)).session?.state).toBe("finished");
  expect((await client.query("select count(*)::int as n from artist_research_jobs")).rows).toEqual([
    { n: 1 },
  ]);
  expect((await startInterviewSession(artist, user, { requestId })).session?.state).toBe(
    "finished",
  );
  expect((await startInterviewSession(artist, user, { requestId: prior })).session?.sitting).toBe(
    3,
  );
});
it("preserves legacy open questions and allows completion without generation or new sittings", async () => {
  await client.exec(
    `update artist_interview_answers set source='offered',answer=null where id='${prior}'`,
  );
  const legacy = (await getInterviewSession(artist, user)).legacyOffers[0];
  expect(legacy.question).toBe("What shaped the sound?");
  await expect(startInterviewSession(artist, user, { requestId })).rejects.toMatchObject({
    code: "legacy_interview_open",
  });
  await saveInterviewAnswer(artist, user, legacy.id, {
    expectedRevision: legacy.revision,
    answer: null,
  });
  expect((await getInterviewSession(artist, user)).legacyOffers).toEqual([]);
});
it("denies revoked ownership on fresh reads and writes", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  await client.exec("update artist_claims set status='rejected'");
  await expect(getInterviewSession(artist, user)).rejects.toMatchObject({ status: 403 });
  await expect(finishInterviewSession(artist, user, session!.id)).rejects.toMatchObject({
    status: 403,
  });
});
it("restores memory when earlier empty sittings were explicitly finished", async () => {
  await client.exec("delete from artist_interview_answers");
  const { session: a } = await startInterviewSession(artist, user, { requestId });
  await finishInterviewSession(artist, user, a!.id);
  const { session: b } = await startInterviewSession(artist, user, { requestId: prior });
  expect(b!.sitting).toBe(2);
  expect((await loadInterviewMemory(artist, user, b!.sitting)).entries).toEqual([]);
});
it("rolls back an offer when its evidence write fails", async () => {
  const { session } = await startInterviewSession(artist, user, { requestId });
  const input = await offerInput(session!.sitting);
  await client.exec(
    "alter table artist_interview_question_evidence add constraint reject_offer check(ordinal<0)",
  );
  try {
    await expect(saveInterviewOffer(artist, user, session!.id, input)).rejects.toThrow();
    expect((await getInterviewSession(artist, user)).session?.questions).toEqual([]);
  } finally {
    await client.exec(
      "alter table artist_interview_question_evidence drop constraint reject_offer",
    );
  }
});
it("rejects a session-scoped instruction from a previous sitting even when the new sitting has no offer", async () => {
  const { saveInterviewBoundary } = await import("@/lib/interviewMemory/saveInterviewBoundary");
  const { session } = await startInterviewSession(artist, user, { requestId });
  await finishInterviewSession(artist, user, session!.id);
  await startInterviewSession(artist, user, { requestId: prior });
  await expect(
    saveInterviewBoundary(artist, user, {
      requestId,
      questionKey: "first",
      wording: "Do not discuss family.",
      scope: "sitting",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
