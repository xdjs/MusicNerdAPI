import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { getAdminReviewQueue } = await import("@/lib/adminReview/getAdminReviewQueue");

const activity = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await test.client.exec(`
    insert into ugcresearch(id, origin, created_at, accepted, ugc_url, site_name, artist_id, date_processed, user_id) values
      ('30000000-0000-4000-8000-000000000001', 'submission', '2026-10-28T10:00:00', false, 'https://instagram.com/bioritmo', 'instagram', '${ids.artist}', null, '${ids.user}'),
      ('30000000-0000-4000-8000-000000000002', 'research', '2026-10-28T09:00:00', true, 'https://x.com/bioritmo', 'x', '${ids.artist}', null, null),
      ('30000000-0000-4000-8000-000000000003', 'submission', '2026-10-28T08:00:00', false, 'https://tiktok.com/@b', 'tiktok', '${ids.artist}', '2026-10-28T08:30:00', null),
      ('30000000-0000-4000-8000-000000000004', 'unknown', '2026-10-28T07:00:00', false, null, 'ugc_discord_ping', '${ids.artist}', null, null);
    insert into artist_activity_events(id, artist_id, actor_user_id, actor_kind, action, trigger, created_at) values
      ('${activity}', '${ids.otherArtist}', '${ids.otherUser}', 'user', 'source_added', 'submission', '2026-10-27T00:00:00Z');
    insert into artist_vault_sources(id, artist_id, url, title, status, origin, activity_id, created_at) values
      ('40000000-0000-4000-8000-000000000001', '${ids.otherArtist}', 'https://example.com/celia', 'Celia interview', 'pending', 'submission', '${activity}', '2026-10-27T00:00:00Z'),
      ('40000000-0000-4000-8000-000000000002', '${ids.artist}', 'https://example.com/approved', 'Old', 'approved', 'research', null, '2026-10-26T00:00:00Z');
    insert into artist_bio_corrections(id, artist_id, user_id, reason, details, source_url, bio_snapshot, status, created_at) values
      ('50000000-0000-4000-8000-000000000001', '${ids.artist}', '${ids.user}', 'Wrong city', 'From Richmond, VA', 'https://example.com/src', 'Salsa from Miami.', 'pending', '2026-10-26T12:00:00Z'),
      ('50000000-0000-4000-8000-000000000002', '${ids.artist}', '${ids.user}', 'Done', null, null, null, 'approved', '2026-10-25T00:00:00Z');
  `);
});
afterAll(() => test.client.close());

describe("getAdminReviewQueue", () => {
  it("lists every pending link, source and correction, newest first, with counts", async () => {
    const queue = await getAdminReviewQueue({ type: "all", query: "", page: 1 });
    expect(queue.items.map(i => [i.type, i.id])).toEqual([
      ["links", "30000000-0000-4000-8000-000000000001"],
      ["sources", "40000000-0000-4000-8000-000000000001"],
      ["corrections", "50000000-0000-4000-8000-000000000001"],
    ]);
    expect(queue.counts).toEqual({ links: 1, sources: 1, corrections: 1 });
    expect(queue.pendingCounts).toEqual({ links: 1, sources: 1, corrections: 1 });
    expect(queue).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 25,
      filters: { type: "all", query: "" },
    });
  });

  it("projects each type's fields", async () => {
    const { items } = await getAdminReviewQueue({ type: "all", query: "", page: 1 });
    expect(items[0]).toEqual({
      type: "links",
      id: "30000000-0000-4000-8000-000000000001",
      artistId: ids.artist,
      artistName: "Bio Ritmo",
      title: "instagram",
      url: "https://instagram.com/bioritmo",
      createdAt: expect.stringContaining("2026-10-28 10:00:00"),
      origin: "user",
      actorKind: "user",
      actorName: "salsero",
      actorId: ids.user,
      activityId: null,
      trigger: null,
      bioSnapshot: null,
      details: null,
      reason: null,
    });
    expect(items[1]).toMatchObject({
      origin: "user",
      activityId: activity,
      trigger: "submission",
      actorName: "hidden_fan",
    });
    expect(items[2]).toMatchObject({
      title: "Wrong city",
      url: "https://example.com/src",
      bioSnapshot: "Salsa from Miami.",
      details: "From Richmond, VA",
      reason: "Wrong city",
    });
  });

  it("filters by type, keeping every type's count", async () => {
    const queue = await getAdminReviewQueue({ type: "corrections", query: "", page: 1 });
    expect(queue.items.map(i => i.type)).toEqual(["corrections"]);
    expect(queue.total).toBe(1);
    expect(queue.counts).toEqual({ links: 1, sources: 1, corrections: 1 });
  });

  it("searches the artist, text and contributor; pending counts ignore the search", async () => {
    const queue = await getAdminReviewQueue({ type: "all", query: "celia", page: 1 });
    expect(queue.items.map(i => i.id)).toEqual(["40000000-0000-4000-8000-000000000001"]);
    expect(queue.counts).toEqual({ links: 0, sources: 1, corrections: 0 });
    expect(queue.pendingCounts).toEqual({ links: 1, sources: 1, corrections: 1 });
    expect((await getAdminReviewQueue({ type: "all", query: "fan@example", page: 1 })).total).toBe(
      2,
    );
  });

  it("takes LIKE wildcards literally", async () => {
    expect((await getAdminReviewQueue({ type: "all", query: "%", page: 1 })).total).toBe(0);
  });

  it("answers the last page past the end", async () => {
    expect((await getAdminReviewQueue({ type: "all", query: "", page: 5 })).page).toBe(1);
  });
});
