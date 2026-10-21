import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";

const client = new PGlite();
const driver = drizzle(client);
const database = {
  execute: vi.fn(async (q: Parameters<typeof driver.execute>[0]) => (await driver.execute(q)).rows),
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { getConflictingMusicSourceIds } =
  await import("@/lib/musicLinks/getConflictingMusicSourceIds");

const artistId = "00000000-0000-4000-8000-000000001273";
const otherId = "00000000-0000-4000-8000-000000001274";
const source = {
  id: "apple",
  url: "https://music.apple.com/us/artist/pete-rango/1513734272",
  type: "profile",
};
beforeAll(async () => {
  await client.exec(`create table artists (id uuid primary key, spotify text, deezer text, bandcamp text, subvert text, supercollector text, soundcloud text, audius text, mixcloud text);
create table artist_id_mappings (artist_id uuid, platform text, platform_id text);
create table artist_mapping_exclusions (artist_id uuid, platform text, reason text);`);
}, 120_000);
beforeEach(() => client.exec("truncate artists,artist_id_mappings,artist_mapping_exclusions"));
afterAll(() => client.close());

it("hides a profile that conflicts with the artist's mapping, and ignores releases", async () => {
  await client.exec(
    `insert into artist_id_mappings values ('${artistId}','apple_music','1330310245')`,
  );
  expect(
    await getConflictingMusicSourceIds(artistId, [
      source,
      { id: "release", url: "https://music.apple.com/us/album/rush/123" },
    ]),
  ).toEqual(["apple"]);
});

it("allows the matching mapping and ignores other artists' mappings", async () => {
  await client.exec(
    `insert into artist_id_mappings values ('${artistId}','apple_music','1513734272'),('${otherId}','apple_music','123')`,
  );
  expect(await getConflictingMusicSourceIds(artistId, [source])).toEqual([]);
});

it("hides an id owned by another artist, and an excluded platform", async () => {
  await client.exec(
    `insert into artist_id_mappings values ('${otherId}','apple_music','1513734272')`,
  );
  expect(await getConflictingMusicSourceIds(artistId, [source])).toEqual(["apple"]);
  await client.exec(
    `truncate artist_id_mappings; insert into artist_mapping_exclusions values ('${artistId}','apple_music','name_mismatch')`,
  );
  expect(await getConflictingMusicSourceIds(artistId, [source])).toEqual(["apple"]);
});

it("checks Spotify ownership from the artist columns, case-sensitively", async () => {
  const record = {
    id: "catalog",
    url: "https://open.spotify.com/artist/3DmaZbBPnKSGnxYRpHobss",
    type: "profile",
  };
  await client.exec(
    `insert into artists (id,spotify) values ('${otherId}','3DmaZbBPnKSGnxYRpHobss')`,
  );
  expect(await getConflictingMusicSourceIds(artistId, [record])).toEqual(["catalog"]);
  await client.exec(`update artists set spotify='3dmazbbpnksgnxyrphobss'`);
  expect(await getConflictingMusicSourceIds(artistId, [record])).toEqual([]);
});

it("folds legacy handles: @, case and .eth", async () => {
  const record = { id: "handle", url: "https://release.supercollector.xyz/artist/dupes" };
  await client.exec(`insert into artists (id,supercollector) values ('${otherId}',' @DuPes.ETH ')`);
  expect(await getConflictingMusicSourceIds(artistId, [record])).toEqual(["handle"]);
  await client.exec(`update artists set id='${artistId}'`);
  expect(await getConflictingMusicSourceIds(artistId, [record])).toEqual([]);
});

it("hides every catalog profile when the identity read fails", async () => {
  database.execute.mockRejectedValueOnce(new Error("unavailable"));
  expect(
    await getConflictingMusicSourceIds(artistId, [
      source,
      { id: "release", url: "https://www.beatport.com/track/rush/123" },
    ]),
  ).toEqual(["apple"]);
});
