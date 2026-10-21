import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { UserEntriesQuery } from "@/lib/contributions/validateUserEntriesQuery";
import { createTestDb, ids } from "./testDb";

const test = await createTestDb();
vi.mock("@/lib/db/db", () => ({
  get db() {
    return test.database;
  },
}));
const { listUserEntries } = await import("@/lib/contributions/listUserEntries");

const base: UserEntriesQuery = {
  page: 1,
  siteName: null,
  all: false,
  status: null,
  query: undefined,
  order: "newest",
};
const percent = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  await test.client.exec(`insert into artists(id,name) values ('${percent}','100% Ritmo');`);
  const rows: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const minute = String(i).padStart(2, "0");
    rows.push(
      `('${i % 3 === 0 ? ids.otherArtist : ids.artist}',${i % 2 === 0},'https://example.org/${i}','${i % 2 === 0 ? "bandcamp" : "instagram"}','2026-10-20T10:${minute}:00','${ids.user}')`,
    );
  }
  rows.push(`('${percent}',true,'https://example.org/p','x','2026-10-20T12:00:00','${ids.user}')`);
  rows.push(`(null,true,'https://example.org/n','x','2026-10-20T12:30:00','${ids.user}')`);
  rows.push(
    `('${ids.artist}',true,'https://example.org/o','tiktok','2026-10-20T13:00:00','${ids.otherUser}')`,
  );
  await test.client.exec(
    `insert into ugcresearch(artist_id,accepted,ugc_url,site_name,created_at,user_id) values ${rows.join(",")};`,
  );
});
afterAll(async () => test.client.close());

describe("listUserEntries", () => {
  it("pages the user's links newest first with each artist, and lists only the user's platforms", async () => {
    const first = await listUserEntries(ids.user, base);
    expect(first).toMatchObject({ total: 14, pageCount: 2 });
    expect(first.entries).toHaveLength(10);
    expect(first.entries[0]).toMatchObject({
      ugcUrl: "https://example.org/n",
      artistName: null,
      artistId: null,
      accepted: true,
      siteName: "x",
    });
    expect(first.entries[1]).toMatchObject({ artistName: "100% Ritmo", artistId: percent });
    expect([...first.platforms].sort()).toEqual(["bandcamp", "instagram", "x"]);
    const second = await listUserEntries(ids.user, { ...base, page: 2 });
    expect(second.entries.map(e => e.ugcUrl)).toEqual([
      "https://example.org/4",
      "https://example.org/3",
      "https://example.org/2",
      "https://example.org/1",
    ]);
  });

  it("filters by platform and approval, orders oldest first, and returns everything with `all`", async () => {
    const pending = await listUserEntries(ids.user, {
      ...base,
      siteName: "instagram",
      status: "pending",
    });
    expect(pending.total).toBe(6);
    expect(pending.entries.every(e => e.siteName === "instagram" && e.accepted === false)).toBe(
      true,
    );
    const oldest = await listUserEntries(ids.user, { ...base, order: "oldest", all: true });
    expect(oldest).toMatchObject({ total: 14, pageCount: 1 });
    expect(oldest.entries).toHaveLength(14);
    expect(oldest.entries[0].ugcUrl).toBe("https://example.org/1");
  });

  it("searches the artist's name case-insensitively with LIKE wildcards escaped", async () => {
    const celia = await listUserEntries(ids.user, { ...base, query: "CELIA" });
    expect(celia.total).toBe(4);
    expect(celia.entries.every(e => e.artistName === "Celia Cruz")).toBe(true);
    const literal = await listUserEntries(ids.user, { ...base, query: "100%" });
    expect(literal.entries.map(e => e.artistName)).toEqual(["100% Ritmo"]);
    expect((await listUserEntries(ids.user, { ...base, query: "100_" })).total).toBe(0);
  });
});
