import { afterAll, expect, it, vi } from "vitest";
const m = await vi.hoisted(async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { renderSql } = await import("@/lib/db/__tests__/renderSql");
  const { readFileSync } = await import("node:fs");
  const client = new PGlite();
  await client.exec(`
    create table ugcresearch(id uuid default gen_random_uuid(), artist_id uuid, ugc_url text, site_name text, origin text, created_at timestamp default now(), user_id uuid, accepted boolean default false, date_processed timestamp);
    create table users(id uuid,username text,wallet text,is_hidden boolean);
    create table artist_vault_sources(id uuid default gen_random_uuid(),artist_id uuid,url text,title text,status text,origin text,created_at timestamptz default now(),activity_id uuid,type text,file_path text,podcast_episode_key text);
    create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_user_id uuid,action text,created_at timestamptz);
  `);
  await client.exec(
    readFileSync(new URL("./fixtures/0060_discovery_evidence.sql", import.meta.url), "utf8"),
  );
  const tx = {
    execute: async (q: Parameters<typeof renderSql>[0]) => {
      const s = renderSql(q);
      return (await client.query(s.text, s.params)).rows;
    },
  };
  return { client, tx };
});
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (tx: typeof m.tx) => unknown) => fn(m.tx) },
}));
vi.mock("@/lib/artistLinkReview/lockLinkReview", () => ({ lockLinkReview: async () => {} }));
const { getArtistLinkSuggestions } =
  await import("@/lib/artistLinkReview/getArtistLinkSuggestions");
afterAll(async () => m.client.close());
it("reads JSON evidence through the actual UGC/source union and degrades old or corrupt observations to null", async () => {
  const artist = "11111111-1111-4111-8111-111111111111";
  const evidence = {
    version: 1,
    method: "name_web_search",
    artistName: "Nova",
    sourceUrl: "https://x.com/nova",
    observedTitle: null,
  };
  for (const [url, origin, data] of [
    [evidence.sourceUrl, "research", evidence],
    ["https://x.com/legacy", "research", null],
    ["https://x.com/corrupt", "research", { ...evidence, sourceUrl: "not a url" }],
    ["https://x.com/submission", "submission", evidence],
  ])
    await m.client.query(
      "insert into ugcresearch(artist_id,ugc_url,site_name,origin,discovery_evidence) values($1,$2,'x',$3,$4::jsonb)",
      [artist, url, origin, data === null ? null : JSON.stringify(data)],
    );
  await m.client.query(
    "insert into artist_vault_sources(artist_id,url,title,status,origin,type) values($1,'https://music.apple.com/us/artist/nova/123','Nova','pending','research','profile')",
    [artist],
  );
  const page = await getArtistLinkSuggestions(artist, artist);
  expect(page.items).toHaveLength(5);
  expect(page.items.find(item => item.url === evidence.sourceUrl)?.evidence).toEqual({
    method: "name_web_search",
    artistName: "Nova",
    sourceUrl: evidence.sourceUrl,
    observedTitle: null,
    summary: "A platform search returned this profile with a handle matching “Nova”.",
  });
  expect(
    page.items.filter(item => item.url !== evidence.sourceUrl).map(item => item.evidence),
  ).toEqual([null, null, null, null]);
});
