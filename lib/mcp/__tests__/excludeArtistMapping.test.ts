import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const pg = vi.hoisted(() => ({ client: undefined as unknown as PGlite }));
vi.mock("@/lib/db/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  pg.client = new PGlite();
  return { db: drizzle(pg.client, { schema }) };
});
const { excludeArtistMapping } = await import("@/lib/mcp/excludeArtistMapping");

const artistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const unknownId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// artist_mapping_exclusions as it exists on the staging database.
beforeAll(async () => {
  await pg.client.exec(`
    create table artists (id uuid primary key);
    create type exclusion_reason as enum ('conflict', 'name_mismatch', 'too_ambiguous');
    create table artist_mapping_exclusions (
      id uuid primary key default gen_random_uuid(),
      artist_id uuid not null references artists(id) on delete cascade,
      platform text not null, reason exclusion_reason not null, details text, api_key_hash text,
      created_at timestamptz not null default now(),
      constraint artist_mapping_exclusions_artist_platform_uniq unique (artist_id, platform)
    );
  `);
}, 30000);
beforeEach(async () =>
  pg.client.exec(
    `delete from artist_mapping_exclusions; delete from artists; insert into artists values ('${artistId}');`,
  ),
);
afterAll(async () => pg.client.close());

const rows = async () =>
  (
    await pg.client.query<Record<string, unknown>>(
      "select artist_id, platform, reason, details, api_key_hash from artist_mapping_exclusions order by platform",
    )
  ).rows;
const base = { artistId, platform: "deezer", reason: "conflict" as const };

describe("excludeArtistMapping", () => {
  it("refuses an unknown platform or reason, writing nothing", async () => {
    await expect(excludeArtistMapping({ ...base, platform: "myspace" })).rejects.toThrow(
      new MappingValidationError("Invalid platform: myspace"),
    );
    await expect(
      excludeArtistMapping({ ...base, reason: "bored" as unknown as "conflict" }),
    ).rejects.toThrow(new MappingValidationError("Invalid exclusion reason: bored"));
    expect(await rows()).toEqual([]);
  });

  it("throws MappingNotFoundError for an unknown artist", async () => {
    await expect(excludeArtistMapping({ ...base, artistId: unknownId })).rejects.toThrow(
      new MappingNotFoundError(`Artist not found: ${unknownId}`),
    );
    expect(await rows()).toEqual([]);
  });

  it("creates the row on the first exclusion", async () => {
    expect(await excludeArtistMapping({ ...base, details: "d", apiKeyHash: "hash" })).toEqual({
      created: true,
      updated: false,
    });
    expect(await rows()).toEqual([
      {
        artist_id: artistId,
        platform: "deezer",
        reason: "conflict",
        details: "d",
        api_key_hash: "hash",
      },
    ]);
  });

  it("on a repeat replaces reason, details and key, an omitted one becoming null", async () => {
    await excludeArtistMapping({ ...base, details: "d", apiKeyHash: "hash" });
    expect(await excludeArtistMapping({ ...base, reason: "too_ambiguous" })).toEqual({
      created: false,
      updated: true,
    });
    expect(await rows()).toEqual([
      {
        artist_id: artistId,
        platform: "deezer",
        reason: "too_ambiguous",
        details: null,
        api_key_hash: null,
      },
    ]);
  });

  it("keeps one row per platform", async () => {
    await excludeArtistMapping(base);
    expect(await excludeArtistMapping({ ...base, platform: "tidal" })).toEqual({
      created: true,
      updated: false,
    });
    expect((await rows()).map(row => row.platform)).toEqual(["deezer", "tidal"]);
  });
});
