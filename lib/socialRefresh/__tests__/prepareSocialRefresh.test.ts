import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import type { WriteDb } from "@/lib/db/db";
const guard = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/lib/research/withResearchJobWrite", () => ({ withResearchJobWrite: guard.write }));
import { prepareSocialRefresh } from "../prepareSocialRefresh";
import { storeSocialRefresh } from "../storeSocialRefresh";
const pg = new PGlite();
const orm = drizzle(pg);
const writer = {
  execute: async (q: Parameters<typeof orm.execute>[0]) => (await orm.execute(q)).rows,
} as WriteDb;
const job = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  artistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
const anchors = [{ id: "old", postedAt: "2026-10-01T00:00:00Z" }];
beforeAll(() =>
  pg.exec(
    "create table artist_social_refreshes(artist_id uuid,platform text,account_handle text,scope text,covered_through timestamptz,checked_at timestamptz,scan_started_at timestamptz,status text,item_count integer,run_id text,scan_reference jsonb,primary key(artist_id,platform,account_handle,scope))",
  ),
);
beforeEach(async () => {
  await pg.exec("delete from artist_social_refreshes");
  await pg.query(
    "insert into artist_social_refreshes values($1,'x','artist','profile',null,now()-interval '1 hour',now()-interval '1 hour','limited',1,'prior',$2)",
    [
      job.artistId,
      JSON.stringify({
        anchors,
        observedAt: "2026-10-02T00:00:00Z",
        gapSince: "2026-10-02T00:00:00Z",
      }),
    ],
  );
  guard.write.mockReset();
  guard.write.mockImplementation(async (_a, _j, f) => f(writer));
});
afterAll(() => pg.close());
it("reserves one paid recovery and rejects the next job even before collection", async () => {
  const first = await prepareSocialRefresh(job, "x", "@Artist");
  expect(first.skip).toBeUndefined();
  expect(first.reference?.recoveryAttemptedAt).toBe(first.startedAt);
  expect(first.after).toBe("2026-09-29T00:00:00.000Z");
  expect(await prepareSocialRefresh({ ...job, id: "another" }, "x", "artist")).toMatchObject({
    skip: true,
    needsReview: true,
  });
  expect(guard.write).toHaveBeenCalledWith(job.artistId, job.id, expect.any(Function));
});
it.each([{ posts: [] }, { posts: [{ ...anchors[0], pinned: true }] }])(
  "does not retire missing or newly pinned anchors on recovery",
  async ({ posts }) => {
    const scan = await prepareSocialRefresh(job, "x", "artist");
    await storeSocialRefresh(writer, {
      artistId: job.artistId,
      platform: "x",
      handle: "artist",
      scan,
      runId: "recovery",
      itemCount: posts.length,
      limit: 50,
      allMapped: true,
      posts,
    });
    const next = await prepareSocialRefresh(job, "x", "artist");
    expect(next).toMatchObject({ skip: true, needsReview: true, reference: { anchors } });
  },
);
it("successful resumed collection clears the reservation without a new provider start", async () => {
  const scan = await prepareSocialRefresh(job, "x", "artist");
  await storeSocialRefresh(writer, {
    artistId: job.artistId,
    platform: "x",
    handle: "artist",
    scan,
    runId: "recovery",
    itemCount: 1,
    limit: 50,
    allMapped: true,
    posts: anchors,
  });
  const row = (
    await pg.query<{ scan_reference: Record<string, unknown> }>(
      "select scan_reference from artist_social_refreshes",
    )
  ).rows[0];
  expect(row.scan_reference.gapSince).toBeNull();
  expect(row.scan_reference.recoveryAttemptedAt).toBeUndefined();
  expect(await prepareSocialRefresh(job, "x", "artist")).toMatchObject({ skip: true });
});
it("revocation prevents reserving recovery", async () => {
  guard.write.mockRejectedValue(new Error("revoked"));
  await expect(prepareSocialRefresh(job, "x", "artist")).rejects.toThrow("revoked");
  const row = (
    await pg.query<{ scan_reference: Record<string, unknown> }>(
      "select scan_reference from artist_social_refreshes",
    )
  ).rows[0];
  expect(row.scan_reference.recoveryAttemptedAt).toBeUndefined();
});
