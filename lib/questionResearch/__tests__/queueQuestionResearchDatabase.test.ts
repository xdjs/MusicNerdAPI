import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { queueQuestionResearch } from "../queueQuestionResearch";
import { researchRequestKey } from "../researchRequestKey";
const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: vi.fn() }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({ authorizeArtistKnowledge: vi.fn() }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/activity/recordArtistActivity", () => ({
  recordArtistActivity: vi.fn().mockResolvedValue("33333333-3333-4333-8333-333333333333"),
}));
const client = new PGlite();
const driver = drizzle(client);
const artist = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const request = {
  topic: "known song credits",
  evidenceNeed: "credits",
  freshness: "stored",
} as const;
beforeAll(async () => {
  await client.exec(`create table artists(id uuid primary key); insert into artists values('${artist}'),('${other}');
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,state jsonb,status text default 'pending',activity_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());`);
  mocks.transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(async tx =>
      fn({
        execute: async (query: Parameters<typeof tx.execute>[0]) => (await tx.execute(query)).rows,
      }),
    ),
  );
}, 30000);
beforeEach(async () => {
  await client.exec("delete from artist_research_jobs");
});
afterAll(async () => client.close());
async function seed(n: number, savedOnly = false, id = artist) {
  await client.query(
    `insert into artist_research_jobs(artist_id,kind,status,state) select $1::uuid,'question_research','done',$2::jsonb from generate_series(1,$3::int)`,
    [
      id,
      JSON.stringify({ savedOnly, stage: "complete", key: "different", expectedClaimId: null }),
      n,
    ],
  );
}
it("uses saved evidence after five outside jobs and caps that lane separately", async () => {
  await seed(5);
  const first = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(first).toMatchObject({ outsideResearchReason: "quota", stage: "checking_saved" });
  const { rows } = await client.query<{ state: { savedOnly?: boolean } }>(
    "select state from artist_research_jobs where id=$1::uuid",
    [first.jobId],
  );
  expect(rows[0].state.savedOnly).toBe(true);
  await client.query("update artist_research_jobs set status='failed' where id=$1::uuid", [
    first.jobId,
  ]);
  await seed(4, true);
  await expect(
    queueQuestionResearch(
      artist,
      { kind: "service" },
      { ...request, topic: "different missing credit" },
    ),
  ).rejects.toMatchObject({ status: 429, code: "saved_evidence_quota" });
});
it("does not count saved-only jobs as additional outside collection allowance or usage", async () => {
  await seed(5, true);
  const result = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(result).not.toHaveProperty("outsideResearchReason");
  const { rows } = await client.query<{ state: { savedOnly?: boolean } }>(
    "select state from artist_research_jobs where id=$1::uuid",
    [result.jobId],
  );
  expect(rows[0].state.savedOnly).toBeUndefined();
});
it("finds an exact reusable job behind more than ten unrelated newer rows", async () => {
  const key = researchRequestKey(request);
  const { rows } = await client.query<{ id: string }>(
    `insert into artist_research_jobs(artist_id,kind,status,state,created_at) values($1::uuid,'question_research','done',$2::jsonb,now()-interval '10 minutes') returning id`,
    [artist, JSON.stringify({ key, stage: "complete", expectedClaimId: null })],
  );
  await seed(12);
  const result = await queueQuestionResearch(artist, { kind: "service" }, request);
  expect(result).toMatchObject({ jobId: rows[0].id, reused: true });
});
it("admits at most one concurrent job when only one saved global slot remains", async () => {
  await seed(100, false, other);
  await seed(99, true, "44444444-4444-4444-8444-444444444444");
  const outcomes = await Promise.allSettled([
    queueQuestionResearch(artist, { kind: "service" }, request),
    queueQuestionResearch(
      other,
      { kind: "service" },
      { ...request, topic: "another exact credit" },
    ),
  ]);
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.find(r => r.status === "rejected")).toMatchObject({
    reason: { code: "saved_evidence_quota" },
  });
  const { rows } = await client.query<{ n: number }>(
    "select count(*)::int n from artist_research_jobs where state->'savedOnly'='true'::jsonb",
  );
  expect(rows[0].n).toBe(100);
});
