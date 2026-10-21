import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { getProfileSummary } = await import("@/lib/profile/getProfileSummary");

const me = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const artist = "11111111-1111-4111-8111-111111111111";

beforeEach(async () => {
  await client.exec("delete from artists; delete from ugcresearch; delete from artist_self_edits");
});
afterAll(async () => client.close());

describe("getProfileSummary", () => {
  it("counts the user's submissions, edits and added artists and lists the three latest entries", async () => {
    await client.query(
      "insert into artists(id, name, added_by, custom_image) values($1, 'Bio Ritmo', $2, '/uploads/b.jpg'), ('22222222-2222-4222-8222-222222222222', 'Other', $3, null)",
      [artist, me, other],
    );
    for (const [n, accepted] of [
      [1, true],
      [2, true],
      [3, false],
      [4, true],
    ] as const) {
      await client.query(
        "insert into ugcresearch(artist_id, user_id, accepted, ugc_url, site_name, created_at) values($1, $2, $3, $4, 'bandcamp', $5)",
        [artist, me, accepted, `https://example.com/${n}`, `2026-10-0${n}T00:00:00Z`],
      );
    }
    await client.query(
      "insert into ugcresearch(artist_id, user_id, accepted) values($1, $2, true)",
      [artist, other],
    );
    await client.query(
      "insert into artist_self_edits(artist_id, user_id) values($1, $2), ($1, $2), ($1, $3)",
      [artist, me, other],
    );
    const summary = await getProfileSummary(me);
    expect(summary).toMatchObject({
      totalContributions: 4,
      approved: 3,
      pending: 1,
      selfEdits: 2,
      artistsAdded: 1,
    });
    expect(summary.entries.map(e => e.ugcUrl)).toEqual([
      "https://example.com/4",
      "https://example.com/3",
      "https://example.com/2",
    ]);
    expect(summary.entries[0]).toMatchObject({
      artistId: artist,
      artistName: "Bio Ritmo",
      imageUrl: "/uploads/b.jpg",
      siteName: "bandcamp",
      accepted: true,
    });
    expect(typeof summary.entries[0].id).toBe("string");
    expect(typeof summary.entries[0].createdAt).toBe("string");
  });

  it("is all zeros and no entries for a user without contributions", async () => {
    expect(await getProfileSummary(me)).toEqual({
      totalContributions: 0,
      selfEdits: 0,
      artistsAdded: 0,
      approved: 0,
      pending: 0,
      entries: [],
    });
  });
});
