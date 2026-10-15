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
const seedPosts = [{ id: "1", postedAt: "2026-09-01T00:00:00Z" }];
const input = {
  artistId,
  platform: "x" as const,
  handle: "@Artist",
  scan: {
    ...scan,
    reference: { anchors: seedPosts, observedAt: "2026-09-02T00:00:00Z", gapSince: null },
  },
  posts: seedPosts,
  runId: "run",
  itemCount: 2,
  limit: 50,
  allMapped: true,
};
beforeAll(async () => {
  await pg.exec(
    `create table artist_social_refreshes(artist_id uuid,platform text,account_handle text,scope text,covered_through timestamptz,checked_at timestamptz,scan_started_at timestamptz,status text,item_count integer,run_id text,scan_reference jsonb default '{}',primary key(artist_id,platform,account_handle,scope))`,
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
  await storeSocialRefresh(writer, { ...input, itemCount: 0, posts: [] });
  expect(await readSocialRefresh(artistId, "x", "artist", undefined, writer)).toMatchObject({
    skip: true,
  });
  expect(await saved()).toMatchObject({ status: "limited", account_handle: "artist" });
  expect(
    (await readSocialRefresh(artistId, "x", "different", undefined, writer)).skip,
  ).toBeUndefined();
  expect(
    (await readSocialRefresh(artistId, "tiktok", "artist", undefined, writer)).skip,
  ).toBeUndefined();
});
it.each([{ itemCount: 50, posts: [] }, { posts: [] }])(
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
  await storeSocialRefresh(writer, { ...input, itemCount: 50, scan });
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

it("persists anchor reconnect, preserves a capped gap, and recovers it transactionally", async () => {
  const posts = [
    { id: "1", postedAt: "2026-10-01T00:00:00Z" },
    { id: "2", postedAt: "2026-10-02T00:00:00Z" },
  ];
  await storeSocialRefresh(writer, {
    ...input,
    scan: { startedAt: "2026-10-03T00:00:00Z", providerLimited: true },
    posts,
  });
  expect((await saved()).covered_through).toBeNull();
  await pg.exec("update artist_social_refreshes set checked_at='2026-10-03'");
  const first = await readSocialRefresh(artistId, "x", "artist", undefined, writer);
  expect(first.reference?.anchors.map(a => a.id)).toEqual(["2", "1"]);
  expect(first.after).toBe("2026-09-29T00:00:00.000Z");
  await storeSocialRefresh(writer, {
    ...input,
    scan: { ...first, startedAt: "2026-10-04T00:00:00Z", providerLimited: true },
    posts: [{ id: "3", postedAt: "2026-10-03T00:00:00Z" }],
  });
  expect((await saved()).covered_through).toBeNull();
  await pg.exec("update artist_social_refreshes set checked_at='2026-10-04'");
  const gap = await readSocialRefresh(artistId, "x", "artist", undefined, writer);
  expect(gap.reference?.gapSince).toBe("2026-10-03T00:00:00Z");
  expect(gap.after).toBe(first.after);
  await storeSocialRefresh(writer, {
    ...input,
    scan: { ...gap, startedAt: "2026-10-05T00:00:00Z", providerLimited: true },
    posts: [...posts, { id: "3", postedAt: "2026-10-03T00:00:00Z" }],
  });
  expect((await saved()).status).toBe("complete");
  const reference = (
    await pg.query<{ scan_reference: { gapSince: string | null } }>(
      "select scan_reference from artist_social_refreshes",
    )
  ).rows[0].scan_reference;
  expect(reference.gapSince).toBeNull();
});

it("does not overwrite a concurrent completed reference with a stale planned reference", async () => {
  const firstPosts = [{ id: "old", postedAt: "2026-10-01T00:00:00Z" }];
  await storeSocialRefresh(writer, {
    ...input,
    scan: { startedAt: "2026-10-02T00:00:00Z" },
    posts: firstPosts,
  });
  // This job planned before that first completion and has no reference in its state.
  await storeSocialRefresh(writer, {
    ...input,
    scan: { startedAt: "2026-10-03T00:00:00Z" },
    posts: [{ id: "new", postedAt: "2026-10-02T00:00:00Z" }],
  });
  const row = (
    await pg.query<{ scan_reference: { anchors: { id: string }[]; gapSince: string | null } }>(
      "select scan_reference from artist_social_refreshes",
    )
  ).rows[0];
  expect(row.scan_reference.anchors).toEqual(firstPosts);
  expect(row.scan_reference.gapSince).toBe("2026-10-02T00:00:00Z");
  expect((await saved()).covered_through).toBeNull();
});

it("an unrecognized dataset cannot establish a successful refresh cooldown", async () => {
  await expect(
    storeSocialRefresh(writer, { ...input, allMapped: false, posts: [] }),
  ).rejects.toThrow("Unrecognized account scan results");
  expect(await saved()).toBeUndefined();
  expect(
    (await readSocialRefresh(artistId, "x", "artist", undefined, writer)).skip,
  ).toBeUndefined();
});
it("an unrecognized result cannot replace an earlier valid reference or cooldown", async () => {
  await storeSocialRefresh(writer, input);
  const before = await saved();
  await expect(
    storeSocialRefresh(writer, {
      ...input,
      runId: "bad-payload",
      scan: { startedAt: new Date().toISOString() },
      allMapped: false,
    }),
  ).rejects.toThrow("Unrecognized account scan results");
  expect(await saved()).toEqual(before);
});

it("recognized but limited results retain a gap without becoming a malformed collection", async () => {
  await storeSocialRefresh(writer, { ...input, payloadRecognized: true, allMapped: false });
  expect(await saved()).toMatchObject({ status: "limited", covered_through: null });
  expect((await readSocialRefresh(artistId, "x", "artist", undefined, writer)).skip).toBe(true);
});
