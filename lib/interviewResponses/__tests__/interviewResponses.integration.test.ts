import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { toInterviewResponse } from "../toInterviewResponse";

const client = new PGlite();
const driver = drizzle(client, { schema });
const database = {
  ...driver,
  select: driver.select.bind(driver),
  insert: driver.insert.bind(driver),
  update: driver.update.bind(driver),
  transaction: (fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(tx =>
      fn({
        ...tx,
        query: tx.query,
        select: tx.select.bind(tx),
        insert: tx.insert.bind(tx),
        update: tx.update.bind(tx),
        execute: async (query: Parameters<typeof tx.execute>[0]) => (await tx.execute(query)).rows,
      }),
    ),
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { upsertInterviewAnswer } = await import("@/lib/onboarding/upsertInterviewAnswer");
const { listInterviewResponses } = await import("../listInterviewResponses");
const { readInterviewResponse } = await import("../readInterviewResponse");
const { reviseInterviewResponse } = await import("../reviseInterviewResponse");
const { listInterviewResponseVersions } = await import("../listInterviewResponseVersions");
const artist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const answer = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const admin = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const other = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const claim = "ffffffff-ffff-4fff-8fff-ffffffffffff";

beforeAll(async () => {
  await client.exec(`
    create function uuid_generate_v4() returns uuid language sql as 'select gen_random_uuid()';
    create table artists(id uuid primary key,name text,bio text);
    create table users(id uuid primary key,is_admin boolean);
    create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text,reference_code text,created_at timestamptz,updated_at timestamptz);
    create table artist_interview_answers(id uuid primary key default gen_random_uuid(),artist_id uuid,question_key text,question text,answer text,source text,sitting integer,offered_at timestamptz,created_at timestamptz,unique(artist_id,question_key));
    create table artist_interview_answer_versions(answer_id uuid references artist_interview_answers(id),artist_id uuid,revision text,snapshot jsonb,note text,actor_user_id uuid,captured_at timestamptz default now(),unique(answer_id,revision));
    create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',state jsonb,activity_id uuid,attempts integer default 0,created_at timestamptz default now(),updated_at timestamptz default now());
    create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
    insert into artists values('${artist}','Fixture Artist',null),('${other}','Other Artist',null);
    insert into users values('${owner}',false),('${admin}',true),('${other}',false);
  `);
}, 30000);
beforeEach(async () => {
  await client.exec(`delete from artist_interview_answer_versions;delete from artist_interview_answers;delete from artist_claims;delete from artist_activity_events;delete from artist_research_jobs;
    insert into artist_claims(id,artist_id,user_id,status) values('${claim}','${artist}','${owner}','approved');
    insert into artist_interview_answers values('${answer}','${artist}','demo','Which take did you use?','  The home take.\nOnly for the demo.  ','followup',2,'2026-10-01T00:00:00Z','2026-10-02T00:00:00Z');`);
});
afterAll(async () => client.close());

describe("saved interview responses", () => {
  it("retains exact old and current wording, keeps offer chronology, and queues an attributed refresh atomically", async () => {
    const original = await readInterviewResponse(artist, owner, answer, {});
    const nextText =
      "  The studio take, but only for the released song.\nThe demo used the home take.  ";
    const edited = await reviseInterviewResponse(artist, owner, answer, {
      expectedRevision: original.response.revision,
      answer: nextText,
      note: "Separated demo from release.",
    });
    expect(edited.response.answer).toBe(nextText);
    expect(edited.response.question).toBe(original.response.question);
    expect(edited.response.sitting).toBe(2);
    expect(edited.response.offeredAt).toBe(original.response.offeredAt);
    expect(edited.response.revision).not.toBe(original.response.revision);
    const historical = await readInterviewResponse(artist, owner, answer, {
      revision: original.response.revision,
    });
    expect(historical).toMatchObject({ isCurrent: false, response: original.response });
    expect((await listInterviewResponses(artist, owner, { limit: 10 })).responses[0]).toEqual(
      edited.response,
    );
    const versions = await listInterviewResponseVersions(artist, owner, answer, { limit: 1 });
    expect(versions.versions[0]).toMatchObject({
      isCurrent: true,
      note: "Separated demo from release.",
    });
    const older = await listInterviewResponseVersions(artist, owner, answer, {
      limit: 1,
      cursor: versions.nextCursor!,
    });
    expect(older.versions[0]).toMatchObject({ isCurrent: false, response: original.response });
    expect(older.nextCursor).toBeNull();
    const jobs = await client.query("select kind,status from artist_research_jobs");
    expect(jobs.rows).toEqual([{ kind: "lore_refresh", status: "pending" }]);
    const events = await client.query<{ actor_user_id: string }>(
      "select actor_user_id from artist_activity_events",
    );
    expect(events.rows.every(r => r.actor_user_id === owner)).toBe(true);
    const rows = await driver.select().from(schema.artistInterviewAnswers);
    expect(toInterviewResponse(rows[0]).revision).toBe(edited.response.revision);
  });
  it("rejects stale edits, permits an identical retry, and does not create duplicate versions or refreshes", async () => {
    const original = await readInterviewResponse(artist, owner, answer, {});
    const edit = { expectedRevision: original.response.revision, answer: "The studio take." };
    await reviseInterviewResponse(artist, owner, answer, edit);
    await reviseInterviewResponse(artist, owner, answer, edit);
    await expect(
      reviseInterviewResponse(artist, owner, answer, { ...edit, answer: "A stale replacement" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await client.query("select * from artist_interview_answer_versions")).rows,
    ).toHaveLength(2);
    expect((await client.query("select * from artist_activity_events")).rows).toHaveLength(2);
  });
  it("reauthorizes current ownership for reads, historical reads and edits, including admin and wrong-artist cases", async () => {
    const current = await readInterviewResponse(artist, admin, answer, {});
    await expect(listInterviewResponses(artist, other, {})).rejects.toMatchObject({ status: 403 });
    await expect(readInterviewResponse(other, admin, answer, {})).rejects.toMatchObject({
      status: 404,
    });
    await client.exec(`update artist_claims set status='rejected' where id='${claim}'`);
    await expect(readInterviewResponse(artist, owner, answer, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(listInterviewResponseVersions(artist, owner, answer, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      reviseInterviewResponse(artist, owner, answer, {
        expectedRevision: current.response.revision,
        answer: "Forbidden",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await client.query("select * from artist_interview_answer_versions")).rows,
    ).toHaveLength(0);
  });
  it("does not edit skipped/unanswered questions or return them as artist testimony", async () => {
    await client.exec(
      `update artist_interview_answers set answer=null,source='offered' where id='${answer}'`,
    );
    expect((await listInterviewResponses(artist, owner, {})).responses).toEqual([]);
    await expect(
      reviseInterviewResponse(artist, owner, answer, {
        expectedRevision: "a".repeat(64),
        answer: "Not an edit",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("prevents a legacy submit or skip from overwriting revised wording", async () => {
    const original = await readInterviewResponse(artist, owner, answer, {});
    await reviseInterviewResponse(artist, owner, answer, {
      expectedRevision: original.response.revision,
      answer: "Revised exact words",
    });
    await expect(
      upsertInterviewAnswer({
        artistId: artist,
        questionKey: "demo",
        question: original.response.question,
        answer: original.response.answer,
        sitting: 2,
        source: "followup",
      }),
    ).rejects.toThrow("already has a saved response");
    expect((await readInterviewResponse(artist, owner, answer, {})).response.answer).toBe(
      "Revised exact words",
    );
  });
  it("rolls the entire edit back if refresh persistence fails", async () => {
    const original = await readInterviewResponse(artist, owner, answer, {});
    await client.exec(
      "alter table artist_research_jobs add constraint fail_refresh check(kind <> 'lore_refresh')",
    );
    try {
      await expect(
        reviseInterviewResponse(artist, owner, answer, {
          expectedRevision: original.response.revision,
          answer: "Should roll back",
        }),
      ).rejects.toThrow();
      expect((await readInterviewResponse(artist, owner, answer, {})).response).toEqual(
        original.response,
      );
      expect(
        (await client.query("select * from artist_interview_answer_versions")).rows,
      ).toHaveLength(0);
    } finally {
      await client.exec("alter table artist_research_jobs drop constraint fail_refresh");
    }
  });
});
