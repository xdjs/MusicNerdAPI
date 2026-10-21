import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
vi.mock("@/lib/spotifyMatch/cancelSpotifyMatchForIdentityEdit", () => ({
  cancelSpotifyMatchForIdentityEdit: vi.fn(),
}));
vi.mock("@/lib/artistLinks/recordArtistSelfEdit", () => ({ recordArtistSelfEdit: vi.fn() }));
const { recordArtistSelfEdit } = await import("@/lib/artistLinks/recordArtistSelfEdit");
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
  vi.mocked(recordArtistSelfEdit).mockClear();
  await client.exec(
    "DELETE FROM artists; INSERT INTO artists VALUES ('a1','Synthetic alias','source-a',NULL)",
  );
  database.query.artists.findFirst
    .mockReset()
    .mockResolvedValueOnce({ id: "a1", name: "Synthetic alias", spotify: "source-a", deezer: null })
    .mockResolvedValue(undefined);
});
it("writes the verified pair while both observed slots are unchanged", async () => {
  await writeArtistLinkColumn(
    database as never,
    "a1",
    "deezer",
    evidence.deezerId,
    "https://deezer.com/artist/87797542",
    evidence,
  );
  expect(recordArtistSelfEdit).toHaveBeenCalledWith(
    database,
    "a1",
    "deezer",
    null,
    evidence.deezerId,
    "https://deezer.com/artist/87797542",
  );
  expect((await client.query("SELECT deezer FROM artists")).rows).toEqual([
    { deezer: evidence.deezerId },
  ]);
});
it.each(["UPDATE artists SET spotify='source-b'", "UPDATE artists SET deezer='owner-choice'"])(
  "atomically refuses a catalog change after verification: %s",
  async change => {
    await client.exec(change);
    await expect(
      writeArtistLinkColumn(
        database as never,
        "a1",
        "deezer",
        evidence.deezerId,
        "https://deezer.com/artist/87797542",
        evidence,
      ),
    ).rejects.toThrow("changed during automatic verification");
    expect(recordArtistSelfEdit).not.toHaveBeenCalled();
    expect((await client.query("SELECT deezer FROM artists WHERE deezer='87797542'")).rows).toEqual(
      [],
    );
  },
);
it("does not reuse evidence for a different destination", async () => {
  await expect(
    writeArtistLinkColumn(database as never, "a1", "deezer", "123", undefined, evidence),
  ).rejects.toThrow("does not match");
});

it("rolls back the conditional link write when self-edit recording fails", async () => {
  vi.mocked(recordArtistSelfEdit).mockRejectedValueOnce(new Error("audit failed"));
  await expect(
    client.transaction(async tx => {
      const transactional = {
        ...database,
        execute: async (query: SQL) => {
          const { text, params } = renderSql(query);
          return (await tx.query(text, params)).rows;
        },
      };
      await writeArtistLinkColumn(
        transactional as never,
        "a1",
        "deezer",
        evidence.deezerId,
        "https://deezer.com/artist/87797542",
        evidence,
      );
    }),
  ).rejects.toThrow("audit failed");
  expect((await client.query("SELECT deezer FROM artists")).rows).toEqual([{ deezer: null }]);
});
