import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { getAdminContributions } = await import("@/lib/adminContributions/getAdminContributions");

const activity = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await test.client.exec(`
    insert into ugcresearch(id, origin, created_at, accepted, ugc_url, site_name, artist_id, date_processed, user_id) values
      ('30000000-0000-4000-8000-000000000001', 'submission', '2026-10-28T10:00:00', false, 'https://instagram.com/bioritmo', 'instagram', '${ids.artist}', null, '${ids.user}'),
      ('30000000-0000-4000-8000-000000000002', 'research', '2026-10-28T09:00:00', true, 'https://x.com/bioritmo', 'x', '${ids.artist}', '2026-10-28T09:30:00', null),
      ('30000000-0000-4000-8000-000000000003', 'submission', '2026-10-28T08:00:00', false, 'https://tiktok.com/@b', 'tiktok', '${ids.artist}', '2026-10-28T08:30:00', '${ids.user}'),
      ('30000000-0000-4000-8000-000000000004', 'unknown', '2026-10-28T07:00:00', false, null, 'ugc_discord_ping', '${ids.artist}', null, null);
    insert into artist_activity_events(id, artist_id, actor_user_id, actor_kind, action, trigger, created_at) values
      ('${activity}', '${ids.otherArtist}', '${ids.user}', 'user', 'source_added', 'upload', '2026-10-27T00:00:00Z');
    insert into artist_vault_sources(id, artist_id, url, title, status, origin, activity_id, file_path, created_at) values
      ('40000000-0000-4000-8000-000000000001', '${ids.otherArtist}', 'https://example.com/celia.pdf', 'celia.pdf', 'approved', 'upload', '${activity}', 'x/celia.pdf', '2026-10-27T00:00:00Z'),
      ('40000000-0000-4000-8000-000000000002', '${ids.artist}', 'https://example.com/lore', 'Lore', 'pending', 'research', null, null, '2026-10-26T00:00:00Z');
  `);
});
afterAll(() => test.client.close());

const filters = { userId: "", query: "", origin: "", type: "", status: "pending", page: 1 };

describe("getAdminContributions", () => {
  it("lists pending contributions newest first, with counts per origin", async () => {
    const result = await getAdminContributions(filters);
    expect(result.items.map(i => i.id)).toEqual([
      "30000000-0000-4000-8000-000000000001",
      "40000000-0000-4000-8000-000000000002",
    ]);
    expect(result.counts).toEqual({
      user: { total: 3, pending: 1 },
      research: { total: 2, pending: 1 },
      unknown: { total: 0, pending: 0 },
    });
    expect(result).toMatchObject({
      total: 2,
      page: 1,
      pageSize: 25,
      filters: { status: "pending" },
    });
  });

  it("projects a link and an upload", async () => {
    const { items } = await getAdminContributions({ ...filters, status: "all" });
    expect(items[0]).toEqual({
      id: "30000000-0000-4000-8000-000000000001",
      type: "link",
      origin: "user",
      artistId: ids.artist,
      artistName: "Bio Ritmo",
      title: "instagram",
      url: "https://instagram.com/bioritmo",
      userId: ids.user,
      username: "salsero",
      email: "fan@example.com",
      actorKind: "user",
      status: "pending",
      createdAt: expect.stringContaining("2026-10-28 10:00:00"),
      trigger: null,
      activityId: null,
    });
    expect(items.find(i => i.id === "40000000-0000-4000-8000-000000000001")).toMatchObject({
      type: "upload",
      origin: "user",
      status: "approved",
      userId: ids.user,
      trigger: "upload",
      activityId: activity,
    });
    expect(items.find(i => i.id === "30000000-0000-4000-8000-000000000003")).toMatchObject({
      status: "rejected",
    });
  });

  it("filters by contributor, origin, type, status and search", async () => {
    const one = await getAdminContributions({ ...filters, userId: ids.user, status: "all" });
    expect(one.total).toBe(3);
    expect(one.filters.userId).toBe(ids.user);
    expect(
      (await getAdminContributions({ ...filters, origin: "research", status: "all" })).total,
    ).toBe(2);
    expect((await getAdminContributions({ ...filters, type: "upload", status: "all" })).total).toBe(
      1,
    );
    expect((await getAdminContributions({ ...filters, status: "rejected" })).total).toBe(1);
    expect((await getAdminContributions({ ...filters, query: "celia", status: "all" })).total).toBe(
      1,
    );
  });
});
