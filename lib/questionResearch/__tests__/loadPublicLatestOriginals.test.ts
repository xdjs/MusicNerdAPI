import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { TransactionDb } from "@/lib/ownership/types";
import { loadPublicLatestOriginals } from "../loadPublicLatestOriginals";

import { readPublicResearchSource } from "../readPublicResearchSource";
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: (artistId: string) => loadPublicLatestOriginals(tx, artistId),
}));

const client = new PGlite();
const driver = drizzle(client);
const tx = {
  execute: async (query: Parameters<typeof driver.execute>[0]) =>
    (await driver.execute(query)).rows,
} as unknown as TransactionDb;
const artist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeAll(async () => {
  await client.exec(`set timezone to 'UTC';create table artist_interview_answers(id uuid primary key default gen_random_uuid(),artist_id uuid,question text,answer text,source text,created_at timestamptz);
    create table artist_onboarding_steps(artist_id uuid,step text);`);
}, 30000);
beforeEach(async () => {
  await client.exec("delete from artist_interview_answers;delete from artist_onboarding_steps");
});
afterAll(async () => client.close());

it("includes published followups while excluding private, unanswered, blank and other-artist answers", async () => {
  await client.exec(`insert into artist_interview_answers(artist_id,question,answer,source,created_at) values
    ('${artist}','Is it a studio take?','  Home take. Only the demo.\nNot the final recording.  ','followup','2026-10-01'),
    ('${artist}','Private?','Private onboarding answer','onboarding','2026-10-02'),
    ('${artist}','Private API session?','Private interview answer','interview','2026-10-03'),
    ('${artist}','Unanswered?',null,'followup','2026-10-04'),
    ('${artist}','Blank?','  ','followup','2026-10-05'),
    ('${other}','Other?','Other artist','followup','2026-10-06');`);
  const rows = await loadPublicLatestOriginals(tx, artist);
  expect(rows).toHaveLength(1);
  expect(rows[0].text).toBe(
    "Response saved/updated: 2026-10-01T00:00:00.000Z. This is not the date of events described.\nPublished interview question: Is it a studio take?\nArtist response:\n  Home take. Only the demo.\nNot the final recording.  ",
  );
  expect(rows[0]).toMatchObject({
    url: `https://musicnerd.net/artist/${artist}`,
    evidenceKind: "original_text",
    curation: "approved",
    publishedAt: "2026-10-01T00:00:00.000Z",
    truncated: false,
  });
});

it("only releases onboarding answers after this artist publishes, and hides them again if publication is removed", async () => {
  await client.exec(`insert into artist_interview_answers(artist_id,question,answer,source,created_at) values ('${artist}','Why?','Exact response','onboarding','2026-10-01');
    insert into artist_onboarding_steps values('${other}','publish');`);
  expect(await loadPublicLatestOriginals(tx, artist)).toEqual([]);
  await client.exec(`insert into artist_onboarding_steps values('${artist}','publish')`);
  expect(await loadPublicLatestOriginals(tx, artist)).toHaveLength(1);
  await client.exec(`delete from artist_onboarding_steps where artist_id='${artist}'`);
  expect(await loadPublicLatestOriginals(tx, artist)).toEqual([]);
});

it("keeps source identity stable but changes revision when the public answer is corrected", async () => {
  await client.exec(
    `insert into artist_interview_answers(artist_id,question,answer,source,created_at) values ('${artist}','Which take?','The home take.','followup','2026-10-01')`,
  );
  const [before] = await loadPublicLatestOriginals(tx, artist);
  expect((await loadPublicLatestOriginals(tx, artist))[0].revision).toBe(before.revision);
  await client.exec(
    "update artist_interview_answers set answer='The studio take, only for the final release.'",
  );
  const [after] = await loadPublicLatestOriginals(tx, artist);
  expect(after.sourceId).toBe(before.sourceId);
  expect(after.revision).not.toBe(before.revision);
  expect(after.text).not.toContain("The home take.");
});

it("matches Latest's bounded newest-six published answer selection", async () => {
  await client.exec(`insert into artist_interview_answers(artist_id,question,answer,source,created_at)
    select '${artist}'::uuid,'Question '||n,'Answer '||n,'followup','2026-10-01'::timestamptz + n * interval '1 hour' from generate_series(1,8) n;`);
  const rows = await loadPublicLatestOriginals(tx, artist);
  expect(rows).toHaveLength(6);
  expect(rows[0].text).toContain("Answer 8");
  expect(rows[5].text).toContain("Answer 3");
});

it("replay rejects a changed public answer revision instead of returning stale wording", async () => {
  await client.exec(
    `insert into artist_interview_answers(artist_id,question,answer,source,created_at) values ('${artist}','Which take?','Original answer','followup','2026-10-01')`,
  );
  const [before] = await loadPublicLatestOriginals(tx, artist);
  const result = await readPublicResearchSource(artist, before.sourceId, before.revision, 0, 256);
  expect(result.passage.text).toBe(before.text);
  await client.exec("update artist_interview_answers set answer='Corrected answer'");
  await expect(
    readPublicResearchSource(artist, before.sourceId, before.revision, 0, 256),
  ).rejects.toMatchObject({ status: 409 });
});

it("replay cannot reopen an answer after it becomes private or is deleted", async () => {
  await client.exec(
    `insert into artist_interview_answers(artist_id,question,answer,source,created_at) values ('${artist}','Which take?','Public answer','followup','2026-10-01')`,
  );
  const [before] = await loadPublicLatestOriginals(tx, artist);
  await client.exec("update artist_interview_answers set source='interview'");
  await expect(
    readPublicResearchSource(artist, before.sourceId, before.revision, 0, 256),
  ).rejects.toMatchObject({ status: 404 });
  await client.exec("delete from artist_interview_answers");
  await expect(
    readPublicResearchSource(artist, before.sourceId, before.revision, 0, 256),
  ).rejects.toMatchObject({ status: 404 });
});

it("keeps unknown response dates null and orders dated responses ahead of them", async () => {
  await client.exec(`insert into artist_interview_answers(artist_id,question,answer,source,created_at) values
    ('${artist}','Unknown date?','Undated response','followup',null),
    ('${artist}','Dated?','Dated response','followup','2026-10-01');`);
  const rows = await loadPublicLatestOriginals(tx, artist);
  expect(rows[0].text).toContain("Dated response");
  expect(rows[1].publishedAt).toBeNull();
  expect(rows[1].text).toContain(
    "Response saved/updated: unknown. This is not the date of events described.",
  );
  expect(rows[0].text).toContain(
    "Response saved/updated: 2026-10-01T00:00:00.000Z. This is not the date of events described.",
  );
  expect(JSON.stringify(rows)).not.toContain("1970");
});

it("does not let undated responses crowd dated responses out of the bounded window", async () => {
  await client.exec(`insert into artist_interview_answers(artist_id,question,answer,source,created_at)
    select '${artist}'::uuid,'Unknown date '||n,'Undated response '||n,'followup',null from generate_series(1,6) n;
    insert into artist_interview_answers(artist_id,question,answer,source,created_at) values ('${artist}','Dated?','Dated response','followup','2026-10-01');`);
  const rows = await loadPublicLatestOriginals(tx, artist);
  expect(rows).toHaveLength(6);
  expect(rows[0].text).toContain("Dated response");
});
