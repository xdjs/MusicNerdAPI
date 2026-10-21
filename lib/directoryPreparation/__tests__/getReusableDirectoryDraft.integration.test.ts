import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
vi.mock("@/lib/db/db", () => ({
  db: {
    execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  },
}));
const { getReusableDirectoryDraft } = await import("../getReusableDirectoryDraft");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");
const a = "00000000-0000-4000-8000-000000000001",
  u = "00000000-0000-4000-8000-000000000002",
  c = "00000000-0000-4000-8000-000000000003",
  s = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid,bio text);create table artist_claims(id uuid,artist_id uuid,user_id uuid,status text);create table artist_vault_sources(id uuid,artist_id uuid,status text,body text,file_name text,file_size integer,content_type text);create table artist_directory_preparations(artist_id uuid,status text,document text,about text,starting_bio text,manifest jsonb);create table artist_interview_answers(artist_id uuid);create table artist_doc_corrections(artist_id uuid);create function knowledge_vault_source_snapshot(v artist_vault_sources) returns jsonb language sql as $$select jsonb_build_object('id',v.id,'artistId',v.artist_id,'status',v.status,'url','https://example.com/interview','title','Interview','publishedAt',null,'extractedText',v.body)$$;`,
  );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    `truncate artists,artist_claims,artist_vault_sources,artist_directory_preparations,artist_interview_answers,artist_doc_corrections;insert into artists values('${a}',null);insert into artist_claims values('${c}','${a}','${u}','approved');insert into artist_vault_sources values('${s}','${a}','pending','Original');insert into artist_directory_preparations select '${a}','ready','Doc[1].','About[1].',null,jsonb_build_array(knowledge_vault_source_snapshot(v)) from artist_vault_sources v;`,
  );
});
const read = () =>
  withArtistOperation(a, { userId: u, expectedClaimId: c }, () => getReusableDirectoryDraft(a));
it("is unavailable without a current claimant scope or before source approval", async () => {
  expect(await getReusableDirectoryDraft(a)).toBeNull();
  expect(await read()).toBeNull();
});
it("reuses only the whole unchanged artist-approved manifest", async () => {
  await client.exec("update artist_vault_sources set status='approved'");
  expect(await read()).toMatchObject({
    document: "Doc[1].",
    about: "About[1].",
    sources: [{ id: 1, url: "https://example.com/interview" }],
  });
  await client.exec("update artist_vault_sources set body='Corrected original'");
  expect(await read()).toBeNull();
});
it.each(["rejected", "pending"])("keeps %s sources out of reuse", async status => {
  await client.query("update artist_vault_sources set status=$1", [status]);
  expect(await read()).toBeNull();
});
it("does not omit newer interviews, corrections or bio edits", async () => {
  await client.exec("update artist_vault_sources set status='approved'");
  await client.exec(`insert into artist_interview_answers values('${a}')`);
  expect(await read()).toBeNull();
  await client.exec(
    `truncate artist_interview_answers;insert into artist_doc_corrections values('${a}')`,
  );
  expect(await read()).toBeNull();
  await client.exec("truncate artist_doc_corrections;update artists set bio='New edit'");
  expect(await read()).toBeNull();
});
it("fails closed when ownership changes", async () => {
  await client.exec(
    "update artist_vault_sources set status='approved';update artist_claims set status='rejected'",
  );
  expect(await read()).toBeNull();
});
