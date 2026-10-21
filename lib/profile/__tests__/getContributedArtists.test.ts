import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { client, db } = await vi.hoisted(async () => {
  const { createUserProfileDatabase } = await import("@/lib/db/__tests__/userProfileDatabase");
  return createUserProfileDatabase();
});
vi.mock("@/lib/db/db", () => ({ db }));
const { getContributedArtists } = await import("@/lib/profile/getContributedArtists");

const me = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ids = {
  added: "11111111-1111-4111-8111-111111111111",
  accepted: "22222222-2222-4222-8222-222222222222",
  pending: "33333333-3333-4333-8333-333333333333",
  edited: "44444444-4444-4444-8444-444444444444",
  theirs: "55555555-5555-4555-8555-555555555555",
};

beforeEach(async () => {
  await client.exec("delete from artists; delete from ugcresearch; delete from artist_self_edits");
  await client.query(
    `insert into artists(id, name, added_by, custom_image) values
      ($1, 'Zeta Added', $6, '/uploads/z.jpg'),
      ($2, 'alpha Accepted', null, null),
      ($3, 'Pending Only', null, null),
      ($4, 'Mid Edited', null, 'https://example.com/m.jpg'),
      ($5, 'Theirs', $7, null)`,
    [ids.added, ids.accepted, ids.pending, ids.edited, ids.theirs, me, other],
  );
  await client.query(
    "insert into ugcresearch(artist_id, user_id, accepted) values($1, $3, true), ($2, $3, false), ($1, $4, true)",
    [ids.accepted, ids.pending, me, other],
  );
  await client.query("insert into artist_self_edits(artist_id, user_id) values($1, $2)", [
    ids.edited,
    me,
  ]);
});
afterAll(async () => client.close());

describe("getContributedArtists", () => {
  it("lists artists added, accepted or edited by the user, by name, with the total", async () => {
    const result = await getContributedArtists(me, { offset: 0, limit: 10 });
    expect(result.total).toBe(3);
    expect(result.artists.map(a => a.name)).toEqual(["alpha Accepted", "Mid Edited", "Zeta Added"]);
    expect(result.artists[0]).toEqual({
      id: ids.accepted,
      name: "alpha Accepted",
      customImage: null,
    });
    expect(result.artists[2].customImage).toBe("/uploads/z.jpg");
  });

  it("pages with offset and limit, keeping the full total", async () => {
    const result = await getContributedArtists(me, { offset: 1, limit: 1 });
    expect(result.total).toBe(3);
    expect(result.artists.map(a => a.name)).toEqual(["Mid Edited"]);
  });

  it("searches names case-insensitively and escapes pattern characters", async () => {
    expect(
      (await getContributedArtists(me, { offset: 0, limit: 10, query: "EDIT" })).artists.map(
        a => a.name,
      ),
    ).toEqual(["Mid Edited"]);
    expect((await getContributedArtists(me, { offset: 0, limit: 10, query: "%" })).total).toBe(0);
    expect((await getContributedArtists(me, { offset: 0, limit: 10, query: "_" })).total).toBe(0);
  });

  it("is empty for a user without contributions", async () => {
    expect(
      await getContributedArtists("99999999-9999-4999-8999-999999999999", { offset: 0, limit: 10 }),
    ).toEqual({ artists: [], total: 0 });
  });
});
