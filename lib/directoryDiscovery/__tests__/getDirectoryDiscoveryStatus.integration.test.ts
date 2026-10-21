import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";

const client = new PGlite();
const driver = drizzle(client);
const database = {
  execute: async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows,
  query: { artistVaultSources: { findMany: async () => [] } },
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
vi.mock("@/lib/artists/getArtistById", () => ({
  getArtistById: async () => ({ id: "a", spotify: null, deezer: null }),
}));
vi.mock("@/lib/artists/getArtistLinks", () => ({ getArtistLinks: async () => [] }));
vi.mock("@/lib/musicLinks/getConflictingMusicSourceIds", () => ({
  getConflictingMusicSourceIds: async () => [],
}));
vi.mock("@/lib/links/getHiddenLinkSourceIds", () => ({ getHiddenLinkSourceIds: async () => [] }));
const { getDirectoryDiscoveryStatus } =
  await import("@/lib/directoryDiscovery/getDirectoryDiscoveryStatus");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [artist, adder, admin, stranger, creation, parent] = [1, 2, 3, 4, 5, 6].map(id);
const read = (viewer = adder) => getDirectoryDiscoveryStatus(artist, viewer);

beforeAll(async () => {
  await client.exec(`create table artists(id uuid primary key,added_by uuid,created_at timestamptz);
create table users(id uuid primary key,is_admin boolean);
create table artist_claims(id uuid,artist_id uuid,status text);
create table artist_activity_events(id uuid primary key,artist_id uuid,action text,trigger text,actor_kind text,actor_user_id uuid,parent_activity_id uuid);
create table artist_research_jobs(id uuid primary key default gen_random_uuid(),artist_id uuid,activity_id uuid,kind text,status text,attempts int default 0,state jsonb);
insert into users values('${adder}',false),('${admin}',true),('${stranger}',false);`);
}, 120_000);
beforeEach(async () => {
  await client.exec(`truncate artists,artist_claims,artist_activity_events,artist_research_jobs;
insert into artists values('${artist}','${adder}',now()-interval '1 hour');
insert into artist_activity_events values('${creation}','${artist}','directory_add','directory_add','user','${adder}',null);
insert into artist_research_jobs(id,artist_id,activity_id,kind,status,state) values('${parent}','${artist}','${creation}','source_search','running','{"purpose":"directory_preparation","creationActivityId":"${creation}"}');`);
});
afterAll(() => client.close());

it("the adding account and an admin see the running research; anyone else sees nothing", async () => {
  expect(await read()).toMatchObject({ state: "active" });
  expect(await read(admin)).toMatchObject({ state: "active" });
  expect(await read(stranger)).toBeNull();
});

it("reports complete, failed and stopped", async () => {
  await client.exec("update artist_research_jobs set status='done'");
  expect(await read()).toMatchObject({ state: "complete" });
  await client.exec("update artist_research_jobs set status='failed'");
  expect(await read()).toMatchObject({ state: "failed" });
  await client.exec(`insert into artist_claims values('${id(7)}','${artist}','pending')`);
  expect(await read()).toMatchObject({ state: "stopped" });
});

it("stays active while a finished social ingest waits for its caption job", async () => {
  await client.exec(`update artist_research_jobs set status='done';
insert into artist_research_jobs(artist_id,activity_id,kind,status,state) values('${artist}',null,'social_ingest','done','{"directoryActivityId":"${creation}"}')`);
  expect(await read()).toMatchObject({ state: "active" });
  await client.exec(
    `insert into artist_research_jobs(artist_id,kind,status,state) values('${artist}','caption_extract','done','{"directoryActivityId":"${creation}"}')`,
  );
  expect(await read()).toMatchObject({ state: "complete" });
});

it("is unavailable after 24 hours, or without the directory add", async () => {
  await client.exec("update artists set created_at=now()-interval '25 hours'");
  expect(await read()).toBeNull();
  await client.exec("update artists set created_at=now()-interval '1 hour'");
  await client.exec("update artist_activity_events set trigger='manual'");
  expect(await read()).toBeNull();
});
