import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAdminReadsDatabase, ids } from "@/lib/db/__tests__/adminReadsDatabase";

const test = await createAdminReadsDatabase();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.db;
  },
}));
const { getArtistActivity } = await import("@/lib/adminActivity/getArtistActivity");

const e = (n: number) => `20000000-0000-4000-8000-00000000000${n}`;
const source = "40000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  await test.client
    .exec(`insert into artist_activity_events(id, artist_id, actor_user_id, actor_kind, action, trigger, source_id, created_at) values
    ('${e(1)}', '${ids.artist}', '${ids.user}', 'user', 'source_added', 'submission', '${source}', '2026-10-28T10:00:00Z'),
    ('${e(2)}', '${ids.artist}', null, 'system', 'source_added', 'research', null, '2026-10-28T11:00:00Z'),
    ('${e(3)}', '${ids.otherArtist}', '${ids.admin}', 'user', 'link_approved', 'admin', null, '2026-10-28T09:00:00Z');`);
});
afterAll(() => test.client.close());

const all = { query: "", action: "", eventId: "", page: 1 };

describe("getArtistActivity", () => {
  it("lists every event newest first, with artist and actor", async () => {
    const log = await getArtistActivity(all);
    expect(log.items.map(i => i.id)).toEqual([e(2), e(1), e(3)]);
    expect(log.items[1]).toEqual({
      id: e(1),
      artistId: ids.artist,
      artistName: "Bio Ritmo",
      action: "source_added",
      trigger: "submission",
      actorKind: "user",
      actorId: ids.user,
      actorName: "salsero",
      actorEmail: "fan@example.com",
      createdAt: expect.stringContaining("2026-10-28"),
      sourceId: source,
    });
    expect(log).toMatchObject({
      total: 3,
      page: 1,
      pageSize: 25,
      filters: { query: "", action: "", eventId: "" },
    });
  });

  it("filters by action, event and search (artist, username, email, user id)", async () => {
    expect(
      (await getArtistActivity({ ...all, action: "link_approved" })).items.map(i => i.id),
    ).toEqual([e(3)]);
    expect((await getArtistActivity({ ...all, eventId: e(1) })).items.map(i => i.id)).toEqual([
      e(1),
    ]);
    expect((await getArtistActivity({ ...all, query: "celia" })).total).toBe(1);
    expect((await getArtistActivity({ ...all, query: "admin@" })).total).toBe(1);
    expect((await getArtistActivity({ ...all, query: ids.user })).total).toBe(1);
  });

  it("answers the last page past the end", async () => {
    expect((await getArtistActivity({ ...all, page: 7 })).page).toBe(1);
  });
});
