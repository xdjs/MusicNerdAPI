import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { pg, locks } = vi.hoisted(() => ({
  pg: { client: undefined as unknown as PGlite },
  locks: vi.fn(async (_db: unknown, _a: string, _p: string, _id: string) => {}),
}));
vi.mock("@/lib/db/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@/lib/db/schema");
  pg.client = new PGlite();
  return { db: drizzle(pg.client, { schema }) };
});
vi.mock("@/lib/artistLinks/acquireArtistPlatformWriteLocks", () => ({
  acquireArtistPlatformWriteLocks: locks,
}));
const { resolveArtistMapping } = await import("@/lib/mcp/resolveArtistMapping");

const a1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const a2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const unknownId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// artist_id_mappings as it exists on the staging database.
beforeAll(async () => {
  await pg.client.exec(`
    create table artists (id uuid primary key, spotify text, deezer text);
    create type confidence_level as enum ('high', 'medium', 'low', 'manual');
    create table artist_id_mappings (
      id uuid primary key default gen_random_uuid(),
      artist_id uuid not null references artists(id),
      platform text not null, platform_id text not null, confidence confidence_level not null,
      source text not null, reasoning text, api_key_hash text,
      resolved_at timestamptz not null default now(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint artist_id_mappings_artist_platform_uniq unique (artist_id, platform),
      constraint artist_id_mappings_platform_id_uniq unique (platform, platform_id)
    );
  `);
}, 30000);
beforeEach(async () => {
  locks.mockClear();
  await pg.client.exec(
    `delete from artist_id_mappings; delete from artists;
     insert into artists values ('${a1}', null, null), ('${a2}', null, null);`,
  );
});
afterAll(async () => pg.client.close());

type Row = {
  artist_id: string;
  platform: string;
  platform_id: string;
  confidence: string;
  source: string;
  reasoning: string | null;
  api_key_hash: string | null;
  resolved_at: Date;
  updated_at: Date;
};
const rows = async () =>
  (
    await pg.client.query<Row>(
      "select artist_id, platform, platform_id, confidence, source, reasoning, api_key_hash, resolved_at, updated_at from artist_id_mappings order by artist_id, platform",
    )
  ).rows;
const seed = (artistId: string, platform: string, platformId: string, confidence: string) =>
  pg.client.exec(
    `insert into artist_id_mappings (artist_id, platform, platform_id, confidence, source, reasoning, api_key_hash, resolved_at, updated_at)
     values ('${artistId}', '${platform}', '${platformId}', '${confidence}', 'manual', 'old', 'old-hash', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  );

const base = {
  artistId: a1,
  platform: "deezer",
  platformId: "123",
  confidence: "high",
  source: "wikidata",
  apiKeyHash: "hash",
};

describe("resolveArtistMapping", () => {
  it("refuses an invalid platform, source, confidence or empty platformId before any transaction", async () => {
    for (const [patch, message] of [
      [{ platform: "myspace" }, "Invalid platform: myspace"],
      [{ platform: "spotify" }, "Invalid platform: spotify"],
      [{ source: "guess" }, "Invalid source: guess"],
      [{ confidence: "sure" }, "Invalid confidence level: sure"],
      [{ platformId: "  " }, "platformId cannot be empty"],
    ] as const) {
      await expect(resolveArtistMapping({ ...base, ...patch })).rejects.toThrow(
        new MappingValidationError(message),
      );
    }
    expect(locks).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it("takes the platform write locks inside the transaction", async () => {
    await resolveArtistMapping(base);
    expect(locks).toHaveBeenCalledWith(expect.anything(), a1, "deezer", "123");
  });

  it("throws MappingNotFoundError for an unknown artist", async () => {
    await expect(resolveArtistMapping({ ...base, artistId: unknownId })).rejects.toThrow(
      new MappingNotFoundError(`Artist not found: ${unknownId}`),
    );
    expect(await rows()).toEqual([]);
  });

  it("for deezer, refuses an id another artist holds in its deezer column", async () => {
    await pg.client.exec(`update artists set deezer = 'D1' where id = '${a2}'`);
    await expect(resolveArtistMapping({ ...base, platformId: "D1" })).rejects.toThrow(
      new MappingConflictError("platformId D1 on deezer is already owned by a different artist"),
    );
    expect(await rows()).toEqual([]);
  });

  it("for deezer, refuses an id that differs from the artist's own deezer column", async () => {
    await pg.client.exec(`update artists set deezer = '999' where id = '${a1}'`);
    await expect(resolveArtistMapping(base)).rejects.toThrow(
      new MappingConflictError(
        "The artist's deezer field already contains a different platform ID",
      ),
    );
    expect(await rows()).toEqual([]);
  });

  it("inserts when there is no mapping, nulling the omitted reasoning and key", async () => {
    expect(await resolveArtistMapping({ ...base, apiKeyHash: undefined })).toEqual({
      created: true,
      updated: false,
      skipped: false,
    });
    expect(await rows()).toMatchObject([
      {
        artist_id: a1,
        platform: "deezer",
        platform_id: "123",
        confidence: "high",
        source: "wikidata",
        reasoning: null,
        api_key_hash: null,
      },
    ]);
  });

  it("skips a lower-confidence submission and leaves the stored mapping alone", async () => {
    await seed(a1, "deezer", "old", "manual");
    expect(await resolveArtistMapping(base)).toEqual({
      created: false,
      updated: false,
      skipped: true,
      previousMapping: { platformId: "old", confidence: "manual" },
    });
    expect(await rows()).toMatchObject([{ platform_id: "old", confidence: "manual" }]);
  });

  it("updates at equal or higher confidence: every field replaced, an omitted one nulled, resolved_at and updated_at now", async () => {
    await seed(a1, "deezer", "old", "high");
    expect(await resolveArtistMapping({ ...base, apiKeyHash: undefined })).toEqual({
      created: false,
      updated: true,
      skipped: false,
      previousMapping: { platformId: "old", confidence: "high" },
    });
    const [row] = await rows();
    expect(row).toMatchObject({
      platform_id: "123",
      confidence: "high",
      source: "wikidata",
      reasoning: null,
      api_key_hash: null,
    });
    expect(row.resolved_at.getTime()).toBeGreaterThan(Date.parse("2026-01-02T00:00:00Z"));
    expect(row.updated_at.getTime()).toBeGreaterThan(Date.parse("2026-01-02T00:00:00Z"));
  });

  it("maps the platform-id unique violation to a conflict, on insert and on update", async () => {
    await seed(a2, "tidal", "T1", "high");
    const tidal = { ...base, platform: "tidal", platformId: "T1" };
    await expect(resolveArtistMapping(tidal)).rejects.toThrow(
      new MappingConflictError("platformId T1 on tidal is already mapped to a different artist"),
    );
    await seed(a1, "tidal", "T0", "low");
    await expect(resolveArtistMapping(tidal)).rejects.toThrow(MappingConflictError);
    expect((await rows()).map(row => [row.artist_id, row.platform_id])).toEqual([
      [a1, "T0"],
      [a2, "T1"],
    ]);
  });
});
