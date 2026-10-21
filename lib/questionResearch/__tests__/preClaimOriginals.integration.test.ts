import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const client = new PGlite();
const driver = drizzle(client);
const store = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
};
vi.mock("@/lib/db/db", () => ({
  db: { transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(store) },
}));
vi.mock("@/lib/questionResearch/loadPublicLatestOriginals", () => ({
  loadPublicLatestOriginals: async () => [],
}));
vi.mock("@/lib/latestProviders/getStoredLatestProviders", () => ({
  getStoredLatestProviders: async () => ({ originals: [] }),
}));
const { loadPublicResearchOriginals } =
  await import("@/lib/questionResearch/loadPublicResearchOriginals");
const artist = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await client.exec(`
    create table artist_claims(artist_id uuid,status text);
    create table artist_vault_sources(id uuid,artist_id uuid,status text,file_path text,snapshot jsonb,file_name text,file_size integer,content_type text);
    create table artist_social_posts(artist_id uuid,is_own_post boolean,raw jsonb,snapshot jsonb);
    create table artist_research_candidates(id uuid,artist_id uuid,current_revision text,identity text,curation text,reviewed_revision text,destination text,source_id uuid,platform text,platform_id text,url text);
    create table artist_research_evidence(id uuid,candidate_id uuid,artist_id uuid,revision text,original_text text,provenance jsonb,retrieved_at timestamptz);
    create table artists(id uuid);
    create function knowledge_vault_source_snapshot(v artist_vault_sources) returns jsonb language sql as 'select v.snapshot';
    create function knowledge_social_post_snapshot(s artist_social_posts) returns jsonb language sql as 'select s.snapshot';
  `);
  const vault = {
    version: 1,
    kind: "vault",
    id: "00000000-0000-4000-8000-000000000002",
    artistId: artist,
    url: "https://example.com/interview",
    status: "approved",
    origin: "research",
    type: "article",
    filePath: null,
    title: "Interview",
    snippet: null,
    extractedText: "Private prepared evidence",
    publishedAt: null,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: null,
  };
  const social = {
    version: 1,
    kind: "social",
    id: "00000000-0000-4000-8000-000000000003",
    artistId: artist,
    url: "https://instagram.com/p/example",
    platform: "instagram",
    ownerUsername: "example",
    isOwnPost: true,
    caption: "Public caption remains accessible",
    postedAt: "2026-10-12T00:00:00Z",
    transcript: null,
    isRepost: false,
    isRetweet: false,
  };
  await client.query("insert into artist_vault_sources values($1,$2,'approved',null,$3)", [
    vault.id,
    artist,
    JSON.stringify(vault),
  ]);
  await client.query("insert into artist_social_posts values($1,true,'{}',$2)", [
    artist,
    JSON.stringify(social),
  ]);
}, 30000);
afterAll(async () => client.close());
it("keeps public social originals but hides stored Lore until claim and again after revocation", async () => {
  expect((await loadPublicResearchOriginals(artist)).map(s => s.text)).toEqual([
    "Public caption remains accessible",
  ]);
  await client.query("insert into artist_claims values($1,'approved')", [artist]);
  expect((await loadPublicResearchOriginals(artist)).map(s => s.text)).toContain(
    "Private prepared evidence",
  );
  await client.exec("update artist_claims set status='rejected'");
  expect((await loadPublicResearchOriginals(artist)).map(s => s.text)).toEqual([
    "Public caption remains accessible",
  ]);
});
