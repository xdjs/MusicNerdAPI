import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { toResearchJob } from "@/lib/research/toResearchJob";
import type { QuestionResearchState, DiscoveryOriginal } from "@/lib/questionResearch/types";
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
const { queueQuestionResearch } = await import("@/lib/questionResearch/queueQuestionResearch");
const { checkpointQuestionResearch } =
  await import("@/lib/questionResearch/checkpointQuestionResearch");
const { persistResearchOriginals } =
  await import("@/lib/questionResearch/persistResearchOriginals");
const { reviewResearchDiscovery } = await import("@/lib/questionResearch/reviewResearchDiscovery");
const { readResearchEvidence } = await import("@/lib/questionResearch/readResearchEvidence");
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  claim = "00000000-0000-4000-8000-000000000003";
const request = {
  topic: "Album recording credits",
  evidenceNeed: "credits" as const,
  freshness: "stored" as const,
};
const original: DiscoveryOriginal = {
  url: "https://artist.example/record",
  title: "Record",
  text: "The proposed drums were not used on the final recording.",
  identity: "confirmed",
  destination: "lore",
  provenance: {
    kind: "original_text",
    provider: "web",
    speaker: "unverified",
    publisher: "artist.example",
    publishedAt: null,
    retrievedAt: "2026-10-06T00:00:00Z",
    truncated: false,
    limitations: [],
  },
};
beforeAll(async () => {
  const columns = Object.values(getTableColumns(schema.artists))
    .map(c => `"${c.name}" ${c.getSQLType()}${c.primary ? " primary key" : ""}`)
    .join(",");
  await client.exec(`create table artists(${columns});
 create table users(id uuid primary key,is_admin boolean,privy_user_id text);
 create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text);
 create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
 create table artist_vault_sources(id uuid primary key default gen_random_uuid(),artist_id uuid,url text,status text default 'pending',file_path text,extracted_text text,updated_at timestamptz default now(),created_at timestamptz default now(),origin text default 'unknown',activity_id uuid,title text,snippet text,type text,og_image text,podcast_episode_key text,podcast_show_title text,podcast_episode_title text,published_at date,unique(artist_id,url));
 create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',cursor integer default 0,total integer,claimed_at timestamptz,attempts integer default 0,last_error text,state jsonb,activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
 create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
 create table artist_research_candidates(id uuid primary key default gen_random_uuid(),artist_id uuid,url text,destination text,platform text,platform_id text,reason text,identity text default 'unresolved',curation text default 'pending',source_id uuid,reviewed_by uuid,review_activity_id uuid,reviewed_revision text,current_revision text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(artist_id,url));
 create table artist_research_evidence(id uuid primary key default gen_random_uuid(),candidate_id uuid references artist_research_candidates(id) on delete cascade,artist_id uuid,revision text,title text,original_text text,provenance jsonb,retrieved_at timestamptz default now(),unique(candidate_id,revision));
 insert into artists(id,name)values('${artist}','Example Artist');insert into users values('${user}',false,null);`);
}, 30000);
beforeEach(async () => {
  await client.exec(
    `delete from artist_research_candidates;delete from artist_vault_sources;delete from artist_research_jobs;delete from artist_activity_events;delete from artist_claims;insert into artist_claims values('${claim}','${artist}','${user}','approved');update artists set x=null;`,
  );
});
afterAll(async () => client.close());
async function retained(value = original) {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request);
  const row = (
    await client.query<Record<string, unknown>>(
      "update artist_research_jobs set status='running',updated_at=clock_timestamp() where id=$1 returning *,updated_at::text as lease_updated_at",
      [queued.jobId],
    )
  ).rows[0];
  const job = toResearchJob(row);
  const state = job.state as unknown as QuestionResearchState;
  state.stage = "complete";
  await checkpointQuestionResearch(job, state, true, async tx => {
    state.references = await persistResearchOriginals(tx, artist, state, [value]);
  });
  const r = state.references[0];
  const candidate = (
    await client.query<{ id: string }>("select id from artist_research_candidates")
  ).rows[0];
  return { job, state, reference: r, candidate };
}
it("deduplicates concurrently equivalent requests into one durable budget reservation", async () => {
  const [a, b] = await Promise.all([
    queueQuestionResearch(artist, { kind: "service" }, request),
    queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: "  ALBUM recording   credits " },
    ),
  ]);
  expect(a.jobId).toBe(b.jobId);
  expect([a.reused, b.reused].sort()).toEqual([false, true]);
  expect(
    (await client.query("select count(*)::int as n from artist_research_jobs")).rows[0],
  ).toEqual({ n: 1 });
});
it("retains exact pending originals, then atomically approves to Lore and queues refresh", async () => {
  const { reference, candidate } = await retained();
  expect(
    (await client.query("select count(*)::int as n from artist_vault_sources")).rows[0],
  ).toEqual({ n: 0 });
  const before = await readResearchEvidence(
    artist,
    { kind: "service" },
    reference.sourceId.split(":")[1],
    reference.revision,
    0,
    4000,
  );
  expect(before.passage.curation).toBe("pending");
  await reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "approve");
  expect(
    (await client.query("select extracted_text,status from artist_vault_sources")).rows,
  ).toEqual([{ extracted_text: original.text, status: "approved" }]);
  expect(
    (await client.query("select kind from artist_research_jobs where kind='lore_refresh'")).rows,
  ).toHaveLength(1);
  const again = await reviewResearchDiscovery(
    artist,
    user,
    candidate.id,
    reference.revision,
    "approve",
  );
  expect(again.candidate.curation).toBe("approved");
  expect(
    (
      await client.query(
        "select count(*)::int as n from artist_activity_events where action='research_discovery_approve'",
      )
    ).rows[0],
  ).toEqual({ n: 1 });
});
it("rolls promotion back if audit recording fails", async () => {
  const { reference, candidate } = await retained();
  await client.exec(
    "alter table artist_activity_events add constraint reject_review check(action<>'research_discovery_approve')",
  );
  try {
    await expect(
      reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "approve"),
    ).rejects.toThrow();
    expect(
      (await client.query("select count(*)::int as n from artist_vault_sources")).rows[0],
    ).toEqual({ n: 0 });
    expect((await client.query("select curation from artist_research_candidates")).rows[0]).toEqual(
      { curation: "pending" },
    );
  } finally {
    await client.exec("alter table artist_activity_events drop constraint reject_review");
  }
});
it("blocks review after ownership changes and blocks a declined original from public readers", async () => {
  const { reference, candidate } = await retained();
  await client.exec("update artist_claims set status='rejected'");
  await expect(
    reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "approve"),
  ).rejects.toMatchObject({ status: 403 });
  await client.exec("update artist_claims set status='approved'");
  await reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "decline");
  await expect(
    readResearchEvidence(
      artist,
      { kind: "service" },
      reference.sourceId.split(":")[1],
      reference.revision,
      0,
      4000,
    ),
  ).rejects.toMatchObject({ status: 404 });
});
it("does not replace an existing profile during Link approval", async () => {
  const { reference, candidate } = await retained({
    ...original,
    url: "https://x.com/newaccount",
    destination: "link",
    platform: "x",
    platformId: "newaccount",
  });
  await client.exec("update artists set x='existing'");
  await expect(
    reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "approve"),
  ).rejects.toMatchObject({ status: 409, code: "link_conflict" });
  expect((await client.query("select x from artists")).rows[0]).toEqual({ x: "existing" });
});
it("enforces the per-artist rolling budget across completed different requests", async () => {
  for (let i = 0; i < 5; i++) {
    await queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: `record ${i} credits` },
    );
    await client.exec(
      "update artist_research_jobs set status='done',state=jsonb_set(state,'{stage}','\"unresolved\"')",
    );
  }
  await expect(
    queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: "sixth record credits" },
    ),
  ).rejects.toMatchObject({ status: 429, code: "research_quota" });
});

it("preserves a known publication date on approval without making it an event date", async () => {
  const { reference, candidate } = await retained({
    ...original,
    provenance: { ...original.provenance, publishedAt: "2026-10-03T16:00:00Z" },
  });
  await reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "approve");
  expect(
    (await client.query("select published_at::text from artist_vault_sources")).rows[0],
  ).toEqual({ published_at: "2026-10-03" });
});
it("reviews the most recently observed revision even when a page reverts to an older original", async () => {
  const first = await retained();
  await reviewResearchDiscovery(
    artist,
    user,
    first.candidate.id,
    first.reference.revision,
    "approve",
  );
  const changed = { ...original, text: original.text + " A later correction changed the credit." };
  await database.transaction(async tx =>
    persistResearchOriginals(
      tx as Parameters<typeof persistResearchOriginals>[0],
      artist,
      first.state,
      [changed],
    ),
  );
  await database.transaction(async tx =>
    persistResearchOriginals(
      tx as Parameters<typeof persistResearchOriginals>[0],
      artist,
      first.state,
      [original],
    ),
  );
  await expect(
    reviewResearchDiscovery(artist, user, first.candidate.id, first.reference.revision, "approve"),
  ).resolves.toMatchObject({ status: "ok" });
  expect(
    (await client.query("select count(*)::int as n from artist_research_evidence")).rows[0],
  ).toEqual({ n: 2 });
});
it("does not carry an earlier identity confirmation into a changed unverified original", async () => {
  const first = await retained();
  const next = {
    ...original,
    identity: "unresolved" as const,
    text: "A different musician now appears on this page.",
  };
  await database.transaction(async tx =>
    persistResearchOriginals(
      tx as Parameters<typeof persistResearchOriginals>[0],
      artist,
      first.state,
      [next],
    ),
  );
  expect((await client.query("select identity from artist_research_candidates")).rows[0]).toEqual({
    identity: "unresolved",
  });
  await expect(
    readResearchEvidence(
      artist,
      { kind: "service" },
      first.reference.sourceId.split(":")[1],
      first.reference.revision,
      0,
      256,
    ),
  ).rejects.toMatchObject({ status: 404 });
});
