import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
const store = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
};
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(store) },
}));
const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("../generateDirectoryDraft", () => ({ generateDirectoryDraft: m.generate }));
const { recordSourceAssessment } = await import("../recordSourceAssessment");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");
const { runDirectoryPreparation } = await import("../runDirectoryPreparation");
const artist = "00000000-0000-4000-8000-000000000001",
  event = "00000000-0000-4000-8000-000000000002",
  user = "00000000-0000-4000-8000-000000000003",
  source = "00000000-0000-4000-8000-000000000004",
  jobId = "00000000-0000-4000-8000-000000000005";
const job = {
  id: jobId,
  artistId: artist,
  kind: "lore_refresh" as const,
  status: "running" as const,
  cursor: 0,
  total: null,
  attempts: 1,
  updatedAt: "2026-10-12T00:00:00.000Z",
  activityId: event,
  state: { purpose: "directory_preparation", claimId: null, creationActivityId: event },
};
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid,added_by uuid,name text,bio text);create table artist_activity_events(id uuid,artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text);create table artist_claims(artist_id uuid,status text);create table artist_vault_sources(id uuid,artist_id uuid,status text,file_path text,extracted_text text,origin text,activity_id uuid,url text default 'https://example.com/interview',updated_at timestamptz default '2026-10-12T00:00:00Z');create table artist_source_assessments(source_id uuid primary key,artist_id uuid,activity_id uuid,snapshot jsonb,assessed_at timestamptz);create table artist_directory_preparations(artist_id uuid primary key,activity_id uuid,job_id uuid,status text,document text,about text,starting_bio text,manifest jsonb,public_about jsonb,updated_at timestamptz default now());create table artist_research_jobs(id uuid,status text,updated_at timestamptz,attempts integer,claimed_at timestamptz,last_error text);create function knowledge_vault_source_snapshot(v artist_vault_sources) returns jsonb language sql as $$select jsonb_build_object('id',v.id,'artistId',v.artist_id,'status',v.status,'url','https://example.com/interview','title','Interview','publishedAt',null,'extractedText',v.extracted_text)$$;`,
  );
});
afterAll(() => client.close());
beforeEach(async () => {
  await client.exec(
    `truncate artists,artist_activity_events,artist_claims,artist_vault_sources,artist_source_assessments,artist_directory_preparations,artist_research_jobs;insert into artists values('${artist}','${user}','Example',null);insert into artist_activity_events values('${event}','${artist}','${user}','user','directory_add','directory_add');insert into artist_vault_sources(id,artist_id,status,file_path,extracted_text,origin,activity_id) values('${source}','${artist}','pending',null,repeat('Readable original. ',20),'research','${event}');insert into artist_source_assessments(source_id,artist_id,activity_id,snapshot) select id,artist_id,'${event}',knowledge_vault_source_snapshot(v) from artist_vault_sources v;insert into artist_research_jobs values('${jobId}','running','2026-10-12T00:00:00Z',1,now(),'Previous retry');`,
  );
  m.generate.mockReset().mockResolvedValue({
    status: "ready",
    document: "## Overview\nPrivate fact[1].",
    about: "Private About[1].",
  });
});
it("stores private material while leaving public bio and source curation unchanged", async () => {
  expect(await runDirectoryPreparation(job, Date.now() + 50_000)).toMatchObject({ done: true });
  expect(
    (await client.query("select status,claimed_at,last_error from artist_research_jobs")).rows,
  ).toEqual([{ status: "done", claimed_at: null, last_error: null }]);
  expect((await client.query("select bio from artists")).rows).toEqual([{ bio: null }]);
  expect((await client.query("select status from artist_vault_sources")).rows).toEqual([
    { status: "pending" },
  ]);
  expect(
    (await client.query("select status,about,public_about from artist_directory_preparations"))
      .rows,
  ).toEqual([
    {
      status: "ready",
      about: "Private About[1].",
      public_about: {
        version: 1,
        identity: { name: "Example", accounts: {} },
        bio: "Private About.",
        kind: "researched",
        sources: [{ id: source, url: "https://example.com/interview", label: "Interview" }],
      },
    },
  ]);
});
it("rejects originals changed while the model was working", async () => {
  m.generate.mockImplementation(async () => {
    await client.exec("update artist_vault_sources set extracted_text='Changed original'");
    return { status: "ready", document: "Old[1]", about: "Old[1]" };
  });
  await expect(runDirectoryPreparation(job, Date.now() + 50_000)).rejects.toThrow("changed");
  expect((await client.query("select * from artist_directory_preparations")).rows).toHaveLength(0);
});
it("does not publish or store an old draft after any claim begins", async () => {
  m.generate.mockImplementation(async () => {
    await client.exec(`insert into artist_claims values('${artist}','pending')`);
    return { status: "ready", document: "Old[1]", about: "Old[1]" };
  });
  await expect(runDirectoryPreparation(job, Date.now() + 50_000)).rejects.toThrow(
    "ownership changed",
  );
  expect((await client.query("select * from artist_directory_preparations")).rows).toHaveLength(0);
});
it("does not commit from an expired/replaced job lease", async () => {
  m.generate.mockImplementation(async () => {
    await client.exec("update artist_research_jobs set updated_at=now(),attempts=2");
    return { status: "ready", document: "Old[1]", about: "Old[1]" };
  });
  expect(await runDirectoryPreparation(job, Date.now() + 50_000)).toMatchObject({
    done: false,
    waiting: true,
  });
  expect((await client.query("select * from artist_directory_preparations")).rows).toHaveLength(0);
});
it("preserves an edit made while preparation was running", async () => {
  m.generate.mockImplementation(async () => {
    await client.exec("update artists set bio='Artist edit'");
    return { status: "ready", document: "Old[1]", about: "Old[1]" };
  });
  await expect(runDirectoryPreparation(job, Date.now() + 50_000)).rejects.toThrow("changed");
  expect((await client.query("select bio from artists")).rows).toEqual([{ bio: "Artist edit" }]);
});

it("assesses only the unchanged pending original from this creation, without approving it", async () => {
  await client.exec("delete from artist_source_assessments");
  await withArtistOperation(
    artist,
    { expectedClaimId: null, trigger: "directory_add", activityId: event },
    async () => {
      await recordSourceAssessment(store as never, artist, source, {
        text: "Wrong text",
        url: "https://example.com/interview",
        updatedAt: job.updatedAt,
      });
      expect((await client.query("select * from artist_source_assessments")).rows).toHaveLength(0);
      await recordSourceAssessment(store as never, artist, source, {
        text: "Readable original. ".repeat(20),
        url: "https://example.com/interview",
        updatedAt: job.updatedAt,
      });
    },
  );
  expect((await client.query("select * from artist_source_assessments")).rows).toHaveLength(1);
  expect((await client.query("select status from artist_vault_sources")).rows).toEqual([
    { status: "pending" },
  ]);
});

it("does not use a source rejected during generation", async () => {
  m.generate.mockImplementation(async () => {
    await client.exec("update artist_vault_sources set status='rejected'");
    return { status: "ready", document: "Old[1]", about: "Old[1]" };
  });
  await expect(runDirectoryPreparation(job, Date.now() + 50_000)).rejects.toThrow("changed");
  expect((await client.query("select * from artist_directory_preparations")).rows).toHaveLength(0);
});

it("excludes readable historical pending text without an exact identity assessment", async () => {
  await client.exec("delete from artist_source_assessments");
  const { loadDirectoryMaterial } = await import("../loadDirectoryMaterial");
  const material = await loadDirectoryMaterial(store as never, artist, event);
  expect(material.manifest).toEqual([]);
  expect((await client.query("select extracted_text from artist_vault_sources")).rows[0]).toEqual({
    extracted_text: "Readable original. ".repeat(20),
  });
});
it("clears the public projection when current evidence becomes insufficient", async () => {
  await runDirectoryPreparation(job, Date.now() + 50_000);
  await client.exec(
    `update artist_research_jobs set status='running',updated_at='2026-10-12T00:00:00Z';delete from artist_source_assessments`,
  );
  m.generate.mockResolvedValue({ status: "insufficient", document: null, about: null });
  await runDirectoryPreparation(job, Date.now() + 50_000);
  expect(
    (await client.query("select public_about from artist_directory_preparations")).rows,
  ).toEqual([{ public_about: null }]);
});
it("does not commit when the saved artist account changes during generation", async () => {
  await client.exec("alter table artists add column if not exists soundcloud text");
  m.generate.mockImplementation(async () => {
    await client.exec("update artists set soundcloud='new-account'");
    return { status: "ready", document: "Old[1]", about: "Old[1]" };
  });
  await expect(runDirectoryPreparation(job, Date.now() + 50_000)).rejects.toThrow("changed");
  expect((await client.query("select * from artist_directory_preparations")).rows).toHaveLength(0);
});
