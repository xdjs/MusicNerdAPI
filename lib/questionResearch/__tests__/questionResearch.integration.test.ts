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
const { continueQuestionResearch } =
  await import("@/lib/questionResearch/continueQuestionResearch");
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
it("keeps one global saved admission per question without an artist cap", async () => {
  for (let i = 0; i < 11; i++) {
    const queued = await queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: `record ${i} credits` },
    );
    expect(queued).not.toHaveProperty("outsideResearchReason");
    await client.exec(
      "update artist_research_jobs set status='done',state=jsonb_set(state,'{stage}','\"unresolved\"')",
    );
  }
  expect(
    (
      await client.query(
        "select count(*)::int n from artist_research_jobs where state->>'budgetVersion'='2' and state->>'outsideReservedAt' is null",
      )
    ).rows[0],
  ).toEqual({ n: 11 });
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

it("does not reopen approved Lore evidence publicly after the claim is revoked", async () => {
  const { reference, candidate } = await retained();
  await reviewResearchDiscovery(artist, user, candidate.id, reference.revision, "approve");
  await client.exec("update artist_claims set status='rejected'");
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

const directReference = {
  sourceId: "vault:example",
  revision: "a".repeat(64),
  start: 0,
  end: original.text.length,
  text: original.text,
  url: original.url,
  curation: "approved" as const,
  evidenceKind: "original_text" as const,
  speaker: "not_applicable" as const,
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
};
const directOptions = { directCandidates: [directReference] };
it("offers candidates as one durable reservation and continues the same job exactly once", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  expect(queued).toMatchObject({ selection: "candidates", stage: "complete", references: [] });
  const before = (
    await client.query<{ state: QuestionResearchState; activity_id: string }>(
      "select state,activity_id from artist_research_jobs where id=$1",
      [queued.jobId],
    )
  ).rows[0];
  expect(before.state).toMatchObject({
    directAttempted: true,
    selection: "candidates",
    references: [directReference],
  });
  expect(before.state.request).toEqual(request);
  const results = await Promise.all([
    continueQuestionResearch(artist, queued.jobId, { kind: "service" }),
    continueQuestionResearch(artist, queued.jobId, { kind: "service" }),
  ]);
  for (const result of results)
    expect(result).toMatchObject({
      jobId: queued.jobId,
      selection: "research",
      stage: "checking_saved",
      references: [],
    });
  const after = (
    await client.query<{ state: QuestionResearchState; activity_id: string; status: string }>(
      "select state,activity_id,status from artist_research_jobs where id=$1",
      [queued.jobId],
    )
  ).rows[0];
  expect(after.status).toBe("pending");
  expect(after.activity_id).toBe(before.activity_id);
  expect(after.state).toMatchObject({
    directAttempted: true,
    selection: "research",
    step: "saved",
    createdAt: before.state.createdAt,
    key: before.state.key,
    modelCalls: 0,
    providerCalls: 0,
  });
  expect((await client.query("select count(*)::int n from artist_research_jobs")).rows[0]).toEqual({
    n: 1,
  });
  expect(
    (await client.query("select count(*)::int n from artist_activity_events")).rows[0],
  ).toEqual({ n: 1 });
});
it("does not let legacy callers reuse candidate-only selections", async () => {
  const candidate = await queueQuestionResearch(
    artist,
    { kind: "service" },
    request,
    directOptions,
  );
  const reused = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  expect(reused).toMatchObject({ jobId: candidate.jobId, reused: true, selection: "candidates" });
  const normal = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(normal.jobId).not.toBe(candidate.jobId);
  expect(normal.stage).toBe("checking_saved");
  expect(normal).not.toHaveProperty("selection");
  await expect(
    continueQuestionResearch(artist, candidate.jobId, { kind: "service" }),
  ).rejects.toMatchObject({ status: 429, code: "research_busy" });
  expect(
    (await client.query("select status from artist_research_jobs where id=$1", [candidate.jobId]))
      .rows[0],
  ).toEqual({ status: "done" });
});
it("uses ordinary saved research for an empty candidate selection without offering another direct attempt", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request, {
    directCandidates: [],
  });
  expect(queued).toMatchObject({ selection: "research", stage: "checking_saved" });
  expect(
    (
      await client.query(
        "select state->'directAttempted' as attempted from artist_research_jobs where id=$1",
        [queued.jobId],
      )
    ).rows[0],
  ).toEqual({ attempted: true });
  expect(await continueQuestionResearch(artist, queued.jobId, { kind: "service" })).toMatchObject({
    stage: "checking_saved",
    jobId: queued.jobId,
  });
});
it("preserves one saved admission and no outside charge when continuing candidates", async () => {
  for (let i = 0; i < 5; i++) {
    await queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: `earlier question ${i}` },
    );
    await client.exec(
      "update artist_research_jobs set status='done',state=jsonb_set(state,'{stage}','\"unresolved\"')",
    );
  }
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  expect(queued).toMatchObject({ selection: "candidates" });
  const result = await continueQuestionResearch(artist, queued.jobId, { kind: "service" });
  expect(result).toMatchObject({
    selection: "research",
    jobId: queued.jobId,
  });
  expect(
    (
      await client.query(
        "select count(*)::int n from artist_research_jobs where state->>'budgetVersion'='2' and state->>'outsideReservedAt' is null",
      )
    ).rows[0],
  ).toEqual({ n: 6 });
});
it("does not continue an expired candidate or reset its lifetime", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  await client.query(
    "update artist_research_jobs set state=jsonb_set(state,'{createdAt}',to_jsonb((now()-interval '16 minutes')::text)) where id=$1",
    [queued.jobId],
  );
  await expect(
    continueQuestionResearch(artist, queued.jobId, { kind: "service" }),
  ).rejects.toMatchObject({ status: 410, code: "research_expired" });
  expect(
    (
      await client.query(
        "select status,state->>'selection' selection from artist_research_jobs where id=$1",
        [queued.jobId],
      )
    ).rows[0],
  ).toEqual({ status: "done", selection: "candidates" });
  const fresh = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  expect(fresh.jobId).not.toBe(queued.jobId);
  expect(fresh.reused).toBe(false);
});
it("duplicate continuation preserves the worker's progress and charged counters", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  await continueQuestionResearch(artist, queued.jobId, { kind: "service" });
  await client.query(
    'update artist_research_jobs set status=\'running\',state=state || \'{"stage":"searching","step":"search","modelCalls":2,"providerCalls":1,"outsideReservedAt":"2026-10-15T12:00:00Z","inputTokens":200,"outputTokens":30}\'::jsonb where id=$1',
    [queued.jobId],
  );
  const before = (
    await client.query("select state,status,updated_at from artist_research_jobs where id=$1", [
      queued.jobId,
    ])
  ).rows[0];
  expect(await continueQuestionResearch(artist, queued.jobId, { kind: "service" })).toMatchObject({
    stage: "searching",
    jobId: queued.jobId,
    selection: "research",
  });
  expect(
    (
      await client.query("select state,status,updated_at from artist_research_jobs where id=$1", [
        queued.jobId,
      ])
    ).rows[0],
  ).toEqual(before);
});
it("refuses continuation across an ownership change or from an artist credential", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request, directOptions);
  await expect(
    continueQuestionResearch(artist, queued.jobId, { kind: "artist", userId: user }),
  ).rejects.toMatchObject({ status: 403 });
  await client.exec("update artist_claims set status='rejected'");
  await expect(
    continueQuestionResearch(artist, queued.jobId, { kind: "service" }),
  ).rejects.toMatchObject({ status: 409, code: "research_cancelled" });
});
it("refuses to reset a normal research job through candidate continuation", async () => {
  const queued = await queueQuestionResearch(artist, { kind: "service" }, request);
  await expect(
    continueQuestionResearch(artist, queued.jobId, { kind: "service" }),
  ).rejects.toMatchObject({ status: 409, code: "invalid_transition" });
  await expect(
    queueQuestionResearch(artist, { kind: "artist", userId: user }, request, directOptions),
  ).rejects.toMatchObject({ status: 403 });
});
