import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
const client = new PGlite();
const driver = drizzle(client, { schema });
const database = {
  transaction: (fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(tx =>
      fn({
        ...tx,
        query: tx.query,
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
const { reserveAboutLoreRefresh } = await import("../reserveAboutLoreRefresh");
const artist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const claim = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const outsider = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const auth = { userId: owner, expectedClaimId: claim };
beforeAll(async () => {
  await client.exec(`
    create table artists(id uuid primary key);
    create table users(id uuid primary key,is_admin boolean,email text,username text,username_needs_confirmation boolean,username_prompted_at timestamptz,wallet text,privy_user_id text,created_at timestamptz,updated_at timestamptz,legacy_id integer,is_white_listed boolean,is_super_admin boolean,is_hidden boolean,legacy_link_dismissed boolean,accepted_ugc_count integer);
    create table artist_claims(id uuid primary key,artist_id uuid,user_id uuid,status text,reference_code text,created_at timestamptz,updated_at timestamptz);
    create table artist_docs(artist_id uuid primary key,content text,sources jsonb default '[]');
    create table artist_vault_sources(artist_id uuid,url text,extracted_text text,file_path text,status text);
    create table artist_activity_events(id uuid primary key default gen_random_uuid(),artist_id uuid,actor_user_id uuid,actor_kind text,action text,trigger text,source_id uuid,parent_activity_id uuid,created_at timestamptz default now());
    create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,kind text,status text default 'pending',claimed_at timestamptz,state jsonb,activity_id uuid,attempts integer default 0,created_at timestamptz default now(),updated_at timestamptz default now());
    create unique index live_jobs on artist_research_jobs(artist_id,kind) where status in ('pending','running');
    insert into artists values('${artist}');
    insert into users(id,is_admin) values('${owner}',false),('${outsider}',false);
  `);
}, 30000);
beforeEach(async () => {
  await client.exec(`delete from artist_research_jobs; delete from artist_vault_sources; delete from artist_docs; delete from artist_claims; delete from artist_activity_events;
    insert into artist_claims(id,artist_id,user_id,status) values('${claim}','${artist}','${owner}','approved');`);
});
afterAll(async () => client.close());
it("reserves exactly one Lore job for a new artist, with editor attribution", async () => {
  const results = await Promise.all([
    reserveAboutLoreRefresh(artist, auth),
    reserveAboutLoreRefresh(artist, auth),
  ]);
  expect(results.map(r => r.status).sort()).toEqual(["acquired", "busy"]);
  const jobs = await client.query("select kind,status,state from artist_research_jobs");
  expect(jobs.rows).toEqual([
    { kind: "lore_refresh", status: "running", state: { claimId: claim } },
  ]);
  expect(
    (await client.query("select actor_user_id,trigger from artist_activity_events")).rows,
  ).toEqual([{ actor_user_id: owner, trigger: "about_editor" }]);
});
it("reuses current Lore without creating a job", async () => {
  await client.query("insert into artist_docs(artist_id,content) values($1,'Current Lore')", [
    artist,
  ]);
  expect(await reserveAboutLoreRefresh(artist, auth)).toEqual({ status: "ready" });
  expect((await client.query("select * from artist_research_jobs")).rows).toEqual([]);
});
it("reuses a queued refresh even when an old document exists, preserving requestedAt", async () => {
  await client.query("insert into artist_docs(artist_id,content) values($1,'Old Lore')", [artist]);
  await client.query(
    "insert into artist_research_jobs(artist_id,kind,state) values($1,'lore_refresh',$2)",
    [artist, JSON.stringify({ claimId: claim, requestedAt: "new-source" })],
  );
  expect(await reserveAboutLoreRefresh(artist, auth)).toMatchObject({
    status: "acquired",
    requestedAt: "new-source",
  });
  expect((await client.query("select * from artist_research_jobs")).rows).toHaveLength(1);
});
it.each(["running", "directory", "claim", "attempts"])(
  "does not steal or repurpose a %s job",
  async mode => {
    await client.query(
      "insert into artist_research_jobs(artist_id,kind,status,state,attempts) values($1,'lore_refresh',$2,$3,$4)",
      [
        artist,
        mode === "running" ? "running" : "pending",
        JSON.stringify({
          claimId: mode === "claim" ? null : claim,
          ...(mode === "directory" ? { purpose: "directory_preparation" } : {}),
        }),
        mode === "attempts" ? 99 : 0,
      ],
    );
    expect(await reserveAboutLoreRefresh(artist, auth)).toEqual({ status: "busy" });
  },
);
it("reauthorizes the editor and claim before touching jobs or source material", async () => {
  await expect(reserveAboutLoreRefresh(artist, { ...auth, userId: outsider })).rejects.toThrow(
    "ownership",
  );
  await expect(reserveAboutLoreRefresh(artist, { ...auth, expectedClaimId: null })).rejects.toThrow(
    "ownership",
  );
  expect((await client.query("select * from artist_research_jobs")).rows).toEqual([]);
});
it("permits an authorized admin to prepare an unclaimed newly added artist", async () => {
  await client.exec(`delete from artist_claims;update users set is_admin=true where id='${owner}'`);
  expect(await reserveAboutLoreRefresh(artist, { ...auth, expectedClaimId: null })).toMatchObject({
    status: "acquired",
  });
  expect((await client.query("select state from artist_research_jobs")).rows).toEqual([
    { state: { claimId: null } },
  ]);
  await client.exec(`update users set is_admin=false where id='${owner}'`);
});

it("rebuilds existing Lore when a newly readable approved source is absent from its manifest", async () => {
  await client.query("insert into artist_docs(artist_id,content) values($1,'Old Lore')", [artist]);
  await client.query(
    "insert into artist_vault_sources values($1,'https://example.org/new',$2,null,'approved')",
    [artist, "Readable verified source. ".repeat(30)],
  );
  expect(await reserveAboutLoreRefresh(artist, auth)).toMatchObject({ status: "acquired" });
});
it.each(["pending", "rejected", "unreadable"])(
  "does not rebuild for an ineligible %s source",
  async state => {
    await client.query("insert into artist_docs(artist_id,content) values($1,'Current Lore')", [
      artist,
    ]);
    await client.query(
      "insert into artist_vault_sources values($1,'https://example.org/new',$2,null,$3)",
      [
        artist,
        state === "unreadable" ? null : "Readable source. ".repeat(30),
        state === "unreadable" ? "approved" : state,
      ],
    );
    expect(await reserveAboutLoreRefresh(artist, auth)).toEqual({ status: "ready" });
  },
);
