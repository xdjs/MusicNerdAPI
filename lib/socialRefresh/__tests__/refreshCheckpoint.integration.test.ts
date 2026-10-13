import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { storeSocialRefresh } from "../storeSocialRefresh";
import { readSocialRefresh } from "../readSocialRefresh";
import type { WriteDb } from "@/lib/db/db";
const pg = new PGlite();
const orm = drizzle(pg);
const writer = {
  execute: async (query: Parameters<typeof orm.execute>[0]) => (await orm.execute(query)).rows,
} as WriteDb;
const artistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const scan = { startedAt: new Date(Date.now() - 3600_000).toISOString() };
const input = {
  artistId,
  platform: "x" as const,
  handle: "@Artist",
  scan,
  runId: "run",
  itemCount: 2,
  limit: 50,
  allMapped: true,
};
beforeAll(async () => {
  await pg.exec(
    `create table artist_social_refreshes(artist_id uuid,platform text,account_handle text,scope text,covered_through timestamptz,checked_at timestamptz,scan_started_at timestamptz,status text,item_count integer,run_id text,primary key(artist_id,platform,account_handle,scope))`,
  );
}, 30000);
beforeEach(async () => {
  await pg.exec("delete from artist_social_refreshes");
});
afterAll(() => pg.close());
const saved = async () =>
  (
    await pg.query<{
      covered_through: string | null;
      status: string;
      run_id: string;
      account_handle: string;
    }>("select * from artist_social_refreshes")
  ).rows[0];
it("durably reuses a normalized successful empty scan", async () => {
  await storeSocialRefresh(writer, { ...input, itemCount: 0 });
  expect(await readSocialRefresh(artistId, "x", "artist", undefined, writer)).toMatchObject({
    skip: true,
  });
  expect(await saved()).toMatchObject({ status: "complete", account_handle: "artist" });
  expect(
    (await readSocialRefresh(artistId, "x", "different", undefined, writer)).skip,
  ).toBeUndefined();
  expect(
    (await readSocialRefresh(artistId, "tiktok", "artist", undefined, writer)).skip,
  ).toBeUndefined();
});
it.each([{ itemCount: 50 }, { allMapped: false }, { scan: { ...scan, providerLimited: true } }])(
  "does not advance covered interval on limited results %j",
  async change => {
    await storeSocialRefresh(writer, input);
    const before = (await saved()).covered_through;
    await storeSocialRefresh(writer, {
      ...input,
      scan: { startedAt: new Date().toISOString() },
      ...change,
    });
    expect(await saved()).toMatchObject({ covered_through: before, status: "limited" });
  },
);
it("a capped initial run has no invented coverage", async () => {
  await storeSocialRefresh(writer, { ...input, itemCount: 50 });
  expect(await saved()).toMatchObject({ covered_through: null, status: "limited" });
});
it("a late completion cannot replace newer scan state", async () => {
  await storeSocialRefresh(writer, input);
  await storeSocialRefresh(writer, {
    ...input,
    runId: "older",
    scan: { startedAt: "2020-01-01T00:00:00Z" },
  });
  expect((await saved()).run_id).toBe("run");
});
it("failed transaction does not publish a successful checkpoint", async () => {
  await pg.exec("begin");
  await storeSocialRefresh(writer, input);
  await pg.exec("rollback");
  expect(await saved()).toBeUndefined();
});

it("a latest-only Instagram check cannot suppress broad profile collection", async () => {
  await storeSocialRefresh(writer, {
    ...input,
    platform: "instagram",
    scan: { ...scan, scope: "latest" },
  });
  expect(await readSocialRefresh(artistId, "instagram", "artist", 30, writer)).toMatchObject({
    skip: true,
  });
  expect(
    (await readSocialRefresh(artistId, "instagram", "artist", undefined, writer)).skip,
  ).toBeUndefined();
});
