import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
vi.mock("@/lib/spotifyMatch/cancelSpotifyMatchForIdentityEdit", () => ({
  cancelSpotifyMatchForIdentityEdit: vi.fn(),
}));
const client = new PGlite();
const evidence = { spotifyId: "source-a", deezerId: "87797542", previousDeezerId: null };
const database = {
  query: {
    artists: { findFirst: vi.fn() },
    artistIdMappings: { findFirst: vi.fn(async () => undefined) },
  },
  execute: async (query: SQL) => {
    const { text, params } = renderSql(query);
    return (await client.query(text, params)).rows;
  },
};
beforeAll(async () => {
  await client.exec("CREATE TABLE artists(id text, name text, spotify text, deezer text)");
});
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await client.exec(
    "DELETE FROM artists; INSERT INTO artists VALUES ('a1','Synthetic alias','source-a',NULL)",
  );
  database.query.artists.findFirst
    .mockReset()
    .mockResolvedValueOnce({ id: "a1", name: "Synthetic alias", spotify: "source-a", deezer: null })
    .mockResolvedValue(undefined);
});
it("writes the verified pair while both observed slots are unchanged", async () => {
  await writeArtistLinkColumn(database as never, "a1", "deezer", evidence.deezerId, evidence);
  expect((await client.query("SELECT deezer FROM artists")).rows).toEqual([
    { deezer: evidence.deezerId },
  ]);
});
it.each(["UPDATE artists SET spotify='source-b'", "UPDATE artists SET deezer='owner-choice'"])(
  "atomically refuses a catalog change after verification: %s",
  async change => {
    await client.exec(change);
    await expect(
      writeArtistLinkColumn(database as never, "a1", "deezer", evidence.deezerId, evidence),
    ).rejects.toThrow("changed during automatic verification");
    expect((await client.query("SELECT deezer FROM artists WHERE deezer='87797542'")).rows).toEqual(
      [],
    );
  },
);
it("does not reuse evidence for a different destination", async () => {
  await expect(
    writeArtistLinkColumn(database as never, "a1", "deezer", "123", evidence),
  ).rejects.toThrow("does not match");
});
