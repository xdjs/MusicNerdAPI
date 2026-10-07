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
const { saveInterviewBoundary } = await import("@/lib/interviewMemory/saveInterviewBoundary");
const { retractInterviewBoundary } = await import("@/lib/interviewMemory/retractInterviewBoundary");
const { loadInterviewMemory } = await import("@/lib/interviewMemory/loadInterviewMemory");
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  answer = "00000000-0000-4000-8000-000000000003",
  requestId = "00000000-0000-4000-8000-000000000004",
  claim = "00000000-0000-4000-8000-000000000005";
const input = {
  requestId,
  questionKey: "recording",
  wording: " Please leave my family out of this. ",
  scope: "sitting" as const,
};
beforeAll(async () => {
  await client.exec(
    `create table artist_interview_sessions(id uuid primary key,artist_id uuid,sitting int,state text);create table artists(id uuid primary key,name text,bio text);create table users(id uuid primary key,is_admin boolean);create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text);create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());create table artist_interview_answers(id uuid primary key,artist_id uuid,question_key text,question text,answer text,source text,sitting int,offered_at timestamptz,created_at timestamptz);create table artist_doc_corrections(id uuid primary key default gen_random_uuid(),artist_id uuid,claim text,correction text,kind text,created_at timestamptz default now(),updated_at timestamptz default now());create table artist_interview_boundaries(id uuid primary key default gen_random_uuid(),artist_id uuid,request_id uuid,wording text,scope text,sitting int,origin_answer_id uuid,origin_question_key text,origin_question text,created_by uuid,activity_id uuid,created_at timestamptz default now(),retracted_at timestamptz,retracted_by uuid,retraction_activity_id uuid,unique(artist_id,request_id));insert into artists values('${artist}','Artist',null);insert into users values('${user}',false);`,
  );
}, 30000);
beforeEach(async () => {
  await client.exec(
    `delete from artist_interview_boundaries;delete from artist_activity_events;delete from artist_interview_answers;delete from artist_doc_corrections;delete from artist_claims;insert into artist_claims values('${claim}','${artist}','${user}','approved');insert into artist_interview_answers values('${answer}','${artist}','recording','What shaped this record?','Exact 🥁 answer.','interview',2,'2026-10-01T00:00:00Z','2026-10-06T00:00:00Z');`,
  );
});
afterAll(async () => client.close());
it("keeps exact answer, wrong correction and current boundary after a new read", async () => {
  await client.query(
    "insert into artist_doc_corrections(artist_id,claim,correction,kind)values($1,'I produced the track',null,'wrong')",
    [artist],
  );
  const saved = await saveInterviewBoundary(artist, user, input);
  expect(saved.boundary.wording).toBe(input.wording);
  for (let i = 0; i < 2; i++) {
    const memory = await loadInterviewMemory(artist, user, 2);
    expect(memory.entries.map(e => e.kind)).toEqual(["latest_answer", "correction", "boundary"]);
    expect(memory.entries[0].fields.find(f => f.name === "answer")?.text).toBe("Exact 🥁 answer.");
    expect(memory.entries[1].fields.find(f => f.name === "correction")?.text).toBe(null);
    expect(memory.entries[2].fields.find(f => f.name === "wording")?.text).toBe(input.wording);
  }
});
it("does not turn a plain skip into a boundary or a latest answer", async () => {
  await client.exec("update artist_interview_answers set answer=null,source='skipped'");
  const memory = await loadInterviewMemory(artist, user, 2);
  expect(memory.entries).toEqual([]);
});
it("expires sitting boundaries but preserves explicitly ongoing ones", async () => {
  await saveInterviewBoundary(artist, user, input);
  await saveInterviewBoundary(artist, user, {
    ...input,
    requestId: claim,
    scope: "until_retracted",
  });
  const next = await loadInterviewMemory(artist, user, 3);
  expect(next.entries.filter(e => e.kind === "boundary")).toHaveLength(1);
  expect(next.entries.find(e => e.kind === "boundary")?.metadata.scope).toBe("until_retracted");
});
it("deduplicates identical requests and conflicts on changed wording", async () => {
  const [a, b] = await Promise.all([
    saveInterviewBoundary(artist, user, input),
    saveInterviewBoundary(artist, user, input),
  ]);
  expect(a.boundary.id).toBe(b.boundary.id);
  await expect(
    saveInterviewBoundary(artist, user, { ...input, wording: "Changed" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await client.query("select count(*)::int as n from artist_activity_events")).rows[0],
  ).toEqual({ n: 1 });
});
it("retracts without rewriting original words and treats a repeated retraction as idempotent", async () => {
  const { boundary: b } = await saveInterviewBoundary(artist, user, input);
  await retractInterviewBoundary(artist, user, b.id, b.revision);
  await retractInterviewBoundary(artist, user, b.id, b.revision);
  expect(
    (await loadInterviewMemory(artist, user, 2)).entries.some(e => e.kind === "boundary"),
  ).toBe(false);
  expect((await client.query("select wording from artist_interview_boundaries")).rows[0]).toEqual({
    wording: input.wording,
  });
  expect(
    (await client.query("select count(*)::int as n from artist_activity_events")).rows[0],
  ).toEqual({ n: 2 });
});
it("rejects stale revisions, foreign origins and lost ownership", async () => {
  const { boundary: b } = await saveInterviewBoundary(artist, user, input);
  await expect(retractInterviewBoundary(artist, user, b.id, "a".repeat(64))).rejects.toMatchObject({
    status: 409,
  });
  await expect(
    saveInterviewBoundary(artist, user, { ...input, requestId: claim, questionKey: "not-offered" }),
  ).rejects.toMatchObject({ status: 404 });
  await client.exec("update artist_claims set status='rejected'");
  await expect(loadInterviewMemory(artist, user, 2)).rejects.toMatchObject({ status: 403 });
  await expect(retractInterviewBoundary(artist, user, b.id, b.revision)).rejects.toMatchObject({
    status: 403,
  });
});
it("rolls boundary capture back when attribution cannot be written", async () => {
  await client.exec(
    "alter table artist_activity_events add constraint reject_boundary check(action<>'interview_boundary_created')",
  );
  try {
    await expect(saveInterviewBoundary(artist, user, input)).rejects.toThrow();
    expect(
      (await client.query("select count(*)::int as n from artist_interview_boundaries")).rows[0],
    ).toEqual({ n: 0 });
  } finally {
    await client.exec("alter table artist_activity_events drop constraint reject_boundary");
  }
});
it("rejects a request that skips beyond the next known sitting", async () => {
  await expect(loadInterviewMemory(artist, user, 99)).rejects.toMatchObject({ status: 409 });
});
it("rejects an old sitting instead of omitting the current sitting's boundaries", async () => {
  await saveInterviewBoundary(artist, user, input);
  await expect(loadInterviewMemory(artist, user, 1)).rejects.toMatchObject({ status: 409 });
});
it("uses the same latest-answer reference as shared interview history", async () => {
  const { normalizeArtistKnowledge } = await import("@/lib/knowledge/normalizeArtistKnowledge");
  const expected = normalizeArtistKnowledge({
    artist: { id: artist, name: "Artist", bio: null },
    summary: null,
    vault: [],
    social: [],
    jobs: [],
    corrections: [],
    answers: [
      {
        id: answer,
        artistId: artist,
        questionKey: "recording",
        question: "What shaped this record?",
        answer: "Exact 🥁 answer.",
        source: "interview",
        sitting: 2,
        offeredAt: "2026-10-01T00:00:00.000Z",
        createdAt: "2026-10-06T00:00:00.000Z",
      },
    ],
  }).latestAnswer;
  const memory = await loadInterviewMemory(artist, user, 2);
  expect({ entryId: memory.entries[0].entryId, revision: memory.entries[0].revision }).toEqual(
    expected,
  );
});
