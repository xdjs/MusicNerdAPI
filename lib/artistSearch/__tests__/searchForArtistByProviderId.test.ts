import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { searchForArtistByProviderId } from "@/lib/artistSearch/searchForArtistByProviderId";
const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (q: SQL) => execute(q) } }));
const pg = new PGlite();
const render = (q: SQL) => new PgDialect().sqlToQuery(q);
beforeAll(async () => {
  await pg.exec(
    `CREATE TABLE artists(id text PRIMARY KEY, name text, spotify text, deezer text, bandcamp text, youtube text, youtubechannel text, instagram text, x text, facebook text, tiktok text, custom_image text, bio text); CREATE TABLE artist_id_mappings(artist_id text, platform text, platform_id text);`,
  );
});
afterAll(async () => pg.close());
beforeEach(async () => {
  await pg.exec("DELETE FROM artist_id_mappings; DELETE FROM artists;");
  execute.mockReset().mockImplementation(async (q: SQL) => {
    const rendered = render(q);
    return (await pg.query(rendered.sql, rendered.params)).rows;
  });
});
describe("exact provider ownership SQL", () => {
  it("finds only the exact owner and selects only public fields", async () => {
    await pg.exec(
      "INSERT INTO artists(id,name,deezer,bio) VALUES('exact','Colombo','1975','private'),('similar','Colombo','19750','secret');",
    );
    const rows = await searchForArtistByProviderId("deezer", "1975");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "exact", deezer: "1975", match_type: 0 });
    expect(rows[0]).not.toHaveProperty("bio");
    expect(rows[0]).not.toHaveProperty("hasConflictingMapping");
    expect(execute).toHaveBeenCalledTimes(1);
    expect((await pg.query("SELECT count(*)::int AS n FROM artists")).rows).toEqual([{ n: 2 }]);
  });
  it("supports mapping-only ownership and a consistent direct+mapping owner", async () => {
    await pg.exec(
      "INSERT INTO artists(id,name) VALUES('mapped','Artist'); INSERT INTO artist_id_mappings VALUES('mapped','deezer','1975');",
    );
    expect(await searchForArtistByProviderId("deezer", "1975")).toMatchObject([{ id: "mapped" }]);
    await pg.exec("UPDATE artists SET deezer='1975' WHERE id='mapped';");
    expect(await searchForArtistByProviderId("deezer", "1975")).toHaveLength(1);
  });
  it("rejects differing direct and mapping owners", async () => {
    await pg.exec(
      "INSERT INTO artists(id,deezer) VALUES('direct','1975'),('mapped',null); INSERT INTO artist_id_mappings VALUES('mapped','deezer','1975');",
    );
    await expect(searchForArtistByProviderId("deezer", "1975")).rejects.toThrow(
      "conflicting saved profiles",
    );
  });
  it("rejects a mapping whose own provider column contradicts it", async () => {
    await pg.exec(
      "INSERT INTO artists(id,deezer) VALUES('mapped','2020'); INSERT INTO artist_id_mappings VALUES('mapped','deezer','1975');",
    );
    await expect(searchForArtistByProviderId("deezer", "1975")).rejects.toThrow(
      "conflicting saved profiles",
    );
  });
  it.each(["deezer", "spotify"] as const)(
    "rejects both sides of a conflicting %s identity",
    async platform => {
      await pg.query(`INSERT INTO artists(id, ${platform}) VALUES('direct', $1)`, ["1975"]);
      await pg.query("INSERT INTO artist_id_mappings VALUES('direct', $1, $2)", [platform, "2020"]);
      for (const platformId of ["1975", "2020"])
        await expect(searchForArtistByProviderId(platform, platformId)).rejects.toThrow(
          "conflicting saved profiles",
        );
    },
  );
  it("keeps provider boundaries and values parameterized", async () => {
    await pg.exec(
      "INSERT INTO artists(id,spotify,deezer) VALUES('spotify','1975',null); INSERT INTO artist_id_mappings VALUES('spotify','deezer','2020');",
    );
    expect(await searchForArtistByProviderId("deezer", "1975")).toEqual([]);
    expect(await searchForArtistByProviderId("spotify", "1975")).toMatchObject([{ id: "spotify" }]);
    expect(await searchForArtistByProviderId("deezer", "1975' OR true--")).toEqual([]);
    const rendered = render(execute.mock.calls.at(-1)![0]);
    expect(rendered.sql).not.toContain("1975' OR");
    expect(rendered.params).toContain("1975' OR true--");
  });
});
