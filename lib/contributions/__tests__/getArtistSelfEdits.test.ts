import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, ids } from "./testDb";

const test = await createTestDb();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.database;
  },
}));
const { getArtistSelfEdits } = await import("@/lib/contributions/getArtistSelfEdits");

beforeAll(async () => {
  const rows: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const minute = String(i).padStart(2, "0");
    rows.push(
      `('${ids.artist}','${ids.user}','instagram',${i === 1 ? "null" : `'v${i - 1}'`},'v${i}','https://instagram.com/v${i}','2026-10-20T10:${minute}:00Z')`,
    );
  }
  rows.push(
    `('${ids.otherArtist}','${ids.otherUser}','x',null,'celia','https://x.com/celia','2026-10-20T11:00:00Z')`,
  );
  await test.client.exec(
    `insert into artist_self_edits(artist_id,user_id,site_name,old_value,new_value,submitted_url,created_at) values ${rows.join(",")};`,
  );
});
afterAll(async () => test.client.close());

describe("getArtistSelfEdits", () => {
  it("pages the user's own edits newest first with the artist's name", async () => {
    const first = await getArtistSelfEdits(ids.user);
    expect(first).toMatchObject({ total: 12, page: 1, pageCount: 2 });
    expect(first.entries).toHaveLength(10);
    expect(first.entries[0]).toMatchObject({
      artistId: ids.artist,
      artistName: "Bio Ritmo",
      siteName: "instagram",
      oldValue: "v11",
      newValue: "v12",
    });
    const second = await getArtistSelfEdits(ids.user, 2);
    expect(second.entries.map(e => e.newValue)).toEqual(["v2", "v1"]);
    expect(second.entries[1].oldValue).toBeNull();
  });

  it("clamps a page past the end and below 1, and reports one empty page for a user with no edits", async () => {
    expect(await getArtistSelfEdits(ids.user, 9)).toMatchObject({ page: 2, pageCount: 2 });
    expect(await getArtistSelfEdits(ids.user, 0)).toMatchObject({ page: 1 });
    expect(await getArtistSelfEdits("00000000-0000-4000-8000-0000000000ff")).toEqual({
      entries: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
  });
});
