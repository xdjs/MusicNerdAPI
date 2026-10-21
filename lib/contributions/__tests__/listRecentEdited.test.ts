import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, ids } from "./testDb";

const test = await createTestDb();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.database;
  },
}));
const { listRecentEdited } = await import("@/lib/contributions/listRecentEdited");

const third = "00000000-0000-4000-8000-000000000003";
const fourth = "00000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  await test.client.exec(`
insert into artists(id,name) values ('${third}','Third'),('${fourth}','Fourth');
insert into ugcresearch(id,artist_id,accepted,updated_at,user_id) values
 ('10000000-0000-4000-8000-000000000001','${ids.artist}',true,'2026-10-20T10:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000002','${ids.artist}',true,'2026-10-20T12:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000003','${ids.otherArtist}',true,'2026-10-20T11:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000004','${third}',false,'2026-10-20T13:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000005','${third}',true,'2026-10-20T09:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000006','${fourth}',true,'2026-10-20T08:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000007',null,true,'2026-10-20T14:00:00','${ids.user}'),
 ('10000000-0000-4000-8000-000000000008','${fourth}',true,'2026-10-20T15:00:00','${ids.otherUser}');`);
});
afterAll(async () => test.client.close());

describe("listRecentEdited", () => {
  it("returns the user's three most recently edited distinct artists from approved submissions, with image columns", async () => {
    const rows = await listRecentEdited(ids.user);
    expect(rows.map(row => [row.ugcId, row.artistId])).toEqual([
      ["10000000-0000-4000-8000-000000000002", ids.artist],
      ["10000000-0000-4000-8000-000000000003", ids.otherArtist],
      ["10000000-0000-4000-8000-000000000005", third],
    ]);
    expect(rows[0]).toMatchObject({
      artistName: "Bio Ritmo",
      spotifyId: "3pZWMMjXnxbcxurOCYK5sL",
      deezerId: null,
      customImage: null,
    });
    expect(rows[1]).toMatchObject({
      deezerId: "1234",
      customImage: " https://example.org/celia.jpg ",
    });
  });

  it("is empty for a user with no approved submissions", async () => {
    expect(await listRecentEdited("00000000-0000-4000-8000-0000000000ff")).toEqual([]);
  });
});
