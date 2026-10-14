import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import type { TransactionDb } from "@/lib/ownership/types";
import { getStoredLatestProviders } from "../getStoredLatestProviders";
import { normalizeLatestProviderItems } from "../normalizeLatestProviderItems";
const client = new PGlite();
const driver = drizzle(client);
const tx = {
  execute: async (query: Parameters<typeof driver.execute>[0]) =>
    (await driver.execute(query)).rows,
} as unknown as TransactionDb;
const artist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const addr = `0x${"a".repeat(40)}`;
const moments = normalizeLatestProviderItems("inprocess", addr, {
  moments: [
    {
      id: "1",
      address: addr,
      token_id: "1",
      chain_id: 8453,
      created_at: "2026-10-08T14:15:12Z",
      metadata: { name: "Plugin experiments", description: "Sketch" },
    },
  ],
});
beforeAll(async () => {
  await client.exec(
    `create table artists(id uuid primary key,spotify text,deezer text,inprocess text);create table artist_latest_provider_snapshots(artist_id uuid,provider text,account_id text,items jsonb,checked_at timestamptz,last_attempt_at timestamptz,status text);`,
  );
}, 30000);
beforeEach(async () => {
  await client.exec(
    `delete from artists;delete from artist_latest_provider_snapshots;insert into artists values('${artist}',null,null,'${addr}');`,
  );
  await client.query(
    `insert into artist_latest_provider_snapshots values($1,'inprocess',$2,$3::jsonb,'2026-10-08T15:00:00Z','2026-10-08T15:00:00Z','checked')`,
    [artist, addr, JSON.stringify(moments)],
  );
});
afterAll(async () => client.close());
it("serves the same durable exact original/card with stale coverage, never fabricating publication time", async () => {
  const result = await getStoredLatestProviders(artist, tx);
  expect(result.items).toHaveLength(1);
  expect(result.originals).toHaveLength(1);
  expect(result.originals[0]).toMatchObject({
    publishedAt: null,
    retrievedAt: "2026-10-08T15:00:00.000Z",
    activityDate: "2026-10-08T14:15:12Z",
  });
  expect(result.coverage.find(c => c.provider === "inprocess")).toMatchObject({
    status: "checked",
    stale: true,
  });
});
it("immediately excludes snapshots after a connection changes", async () => {
  await client.exec(`update artists set inprocess='0x${"b".repeat(40)}'`);
  const result = await getStoredLatestProviders(artist, tx);
  expect(result.items).toEqual([]);
  expect(result.originals).toEqual([]);
  expect(result.unavailable).toBe(true);
});
it("retains last good originals on failure and removes hidden/deleted items after successful replacement", async () => {
  await client.exec("update artist_latest_provider_snapshots set status='failed'");
  const failed = await getStoredLatestProviders(artist, tx);
  expect(failed.items).toHaveLength(1);
  expect(failed.unavailable).toBe(true);
  await client.exec(
    "update artist_latest_provider_snapshots set status='checked',items='[]'::jsonb",
  );
  expect((await getStoredLatestProviders(artist, tx)).originals).toEqual([]);
});

it("deduplicates release cards across known providers while retaining links and exact release dates", async () => {
  const spotify = "s".repeat(22);
  const spotifyItems = normalizeLatestProviderItems("spotify", spotify, {
    items: [
      {
        id: "r".repeat(22),
        name: "Record",
        album_type: "album",
        release_date: "2025",
        external_urls: { spotify: `https://open.spotify.com/album/${"r".repeat(22)}` },
      },
    ],
  });
  const deezerItems = normalizeLatestProviderItems("deezer", "12", {
    data: [
      {
        id: 42,
        title: "Record",
        record_type: "album",
        release_date: "2025",
        link: "https://www.deezer.com/album/42",
      },
    ],
  });
  await client.query("update artists set spotify=$1,deezer='12'", [spotify]);
  await client.query(
    "insert into artist_latest_provider_snapshots values($1,'spotify',$2,$3::jsonb,'2026-10-08T15:00:00Z','2026-10-08T15:00:00Z','checked'),($1,'deezer','12',$4::jsonb,'2026-10-08T15:00:00Z','2026-10-08T15:00:00Z','checked')",
    [artist, spotify, JSON.stringify(spotifyItems), JSON.stringify(deezerItems)],
  );
  const result = await getStoredLatestProviders(artist, tx, Date.parse("2026-10-09T00:00:00Z"));
  const releases = result.items.filter(i => i.kind === "release");
  expect(releases).toHaveLength(1);
  expect(releases[0].date).toBe("2025");
  expect(releases[0].listeningLinks?.map(l => l.siteName)).toEqual(["spotify", "deezer"]);
  expect(result.originals.filter(i => i.activityDateKind === "release")).toHaveLength(2);
});

it("keeps every stored original available to research while retaining Latest card limits", async () => {
  const storedMoments = Array.from(
    { length: 13 },
    (_, i) =>
      normalizeLatestProviderItems("inprocess", addr, {
        moments: [
          {
            id: String(i + 1),
            address: addr,
            token_id: String(i + 1),
            chain_id: 8453,
            created_at: `2026-09-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
            metadata: { name: `Moment ${i + 1}`, description: `Original ${i + 1}` },
          },
        ],
      })[0],
  );
  const releases = normalizeLatestProviderItems("deezer", "12", {
    data: Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Release ${i + 1}`,
      record_type: "album",
      release_date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      link: `https://www.deezer.com/album/${i + 1}`,
    })),
  });
  await client.query("update artist_latest_provider_snapshots set items=$1::jsonb", [
    JSON.stringify(storedMoments),
  ]);
  await client.exec("update artists set deezer='12'");
  await client.query(
    "insert into artist_latest_provider_snapshots values($1,'deezer','12',$2::jsonb,'2026-10-08T15:00:00Z','2026-10-08T15:00:00Z','checked')",
    [artist, JSON.stringify(releases)],
  );
  const result = await getStoredLatestProviders(artist, tx, Date.parse("2026-10-09T00:00:00Z"));
  expect(result.items.filter(i => i.kind === "moment")).toHaveLength(12);
  expect(result.items.filter(i => i.kind === "release")).toHaveLength(3);
  expect(result.originals).toHaveLength(18);
  expect(result.originals).toContainEqual(expect.objectContaining(storedMoments[0].original));
  expect(result.originals).toContainEqual(expect.objectContaining(releases[0].original));
  expect(result.originals.every(i => i.retrievedAt === "2026-10-08T15:00:00.000Z")).toBe(true);
});
