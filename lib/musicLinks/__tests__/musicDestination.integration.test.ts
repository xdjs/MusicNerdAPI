import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, type SQL } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";

vi.mock("@/lib/db/db", () => ({
  get db() {
    return adapter;
  },
}));
const client = new PGlite();
const database = drizzle(client, { schema });
function adapt(executor: Pick<typeof database, "query" | "execute" | "insert" | "update">) {
  return {
    query: executor.query,
    insert: executor.insert.bind(executor),
    update: executor.update.bind(executor),
    execute: async (query: SQL) => (await executor.execute(query)).rows,
  };
}
const adapter = {
  ...adapt(database),
  transaction: (fn: (tx: ReturnType<typeof adapt>) => Promise<unknown>) =>
    database.transaction(tx => fn(adapt(tx))),
};
const { insertVaultSource } = await import("@/lib/vault/insertVaultSource");
const { withArtistOperation } = await import("@/lib/ownership/withArtistOperation");
const artistId = "00000000-0000-4000-8000-000000001273";
const userId = "00000000-0000-4000-8000-000000001274";
const claimId = "00000000-0000-4000-8000-000000001275";
const otherId = "00000000-0000-4000-8000-000000001276";
const url = "https://music.apple.com/us/artist/pete-rango/1513734272";
const tables = [
  schema.artists,
  schema.users,
  schema.artistClaims,
  schema.artistVaultSources,
  schema.artistActivityEvents,
  schema.artistIdMappings,
];
beforeAll(async () => {
  await client.exec(
    "CREATE ROLE mnweb; CREATE ROLE anon; CREATE TYPE claim_status AS ENUM ('pending','approved','rejected'); CREATE TYPE source_status AS ENUM ('pending','approved','rejected'); CREATE FUNCTION uuid_generate_v4() RETURNS uuid LANGUAGE SQL AS 'SELECT gen_random_uuid()'",
  );
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map(column => {
      const defaultSql = column.hasDefault
        ? column.name === "id"
          ? "DEFAULT uuid_generate_v4()"
          : column.name === "created_at"
            ? "DEFAULT now()"
            : column.name === "status"
              ? "DEFAULT 'pending'"
              : column.name === "origin"
                ? "DEFAULT 'unknown'"
                : ""
        : "";
      return `"${column.name}" ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : ""} ${column.notNull ? "NOT NULL" : ""} ${defaultSql}`;
    });
    await client.exec(
      `CREATE TABLE "${config.name}" (${columns.join(",")}); ALTER TABLE "${config.name}" ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_app ON "${config.name}" TO mnweb USING (true) WITH CHECK (true); GRANT SELECT, INSERT, UPDATE ON "${config.name}" TO mnweb;`,
    );
  }
  await client.exec(
    "CREATE UNIQUE INDEX source_url ON artist_vault_sources(artist_id,url); CREATE TABLE artist_mapping_exclusions(artist_id uuid, platform text, reason text); ALTER TABLE artist_mapping_exclusions ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_app ON artist_mapping_exclusions TO mnweb USING (true); GRANT SELECT ON artist_mapping_exclusions TO mnweb;",
  );
}, 30000);
beforeEach(async () => {
  await client.exec(
    "RESET ROLE; TRUNCATE artists, users, artist_claims, artist_vault_sources, artist_activity_events, artist_id_mappings, artist_mapping_exclusions",
  );
  await database.insert(schema.artists).values([
    { id: artistId, name: "Pete Rango" },
    { id: otherId, name: "Other Artist" },
  ]);
  await database.insert(schema.users).values({ id: userId, isAdmin: false });
  await database
    .insert(schema.artistClaims)
    .values({ id: claimId, artistId, userId, status: "approved" });
  await client.exec("SET ROLE mnweb");
});
afterAll(async () => {
  await client.close();
});
const save = (sourceUrl = url) =>
  withArtistOperation(
    artistId,
    { expectedClaimId: claimId, userId, sourceOrigin: "research", trigger: "source_search" },
    () => insertVaultSource({ artistId, url: sourceUrl, type: "article", title: "Pete Rango" }),
  );

describe("catalog source persistence with real PostgreSQL and application role", () => {
  it("treats another artist's pending evidence as a source, not a canonical identity reservation", async () => {
    await database.insert(schema.artistVaultSources).values({
      artistId: otherId,
      url,
      type: "music",
      status: "pending",
      origin: "research",
    });
    expect(await save()).toMatchObject({ artistId, status: "pending" });
    expect(await database.query.artistIdMappings.findMany()).toEqual([]);
    expect(await database.query.artistVaultSources.findMany()).toHaveLength(2);
    await database.insert(schema.artistIdMappings).values({
      id: crypto.randomUUID(),
      artistId: otherId,
      platform: "apple_music",
      platformId: "1513734272",
    });
    expect(await save("https://itunes.apple.com/artist/id1513734272")).toBeUndefined();
  });
  it("retains the original URL, pending review and attribution, without writing a mapping", async () => {
    const source = await save();
    expect(source).toMatchObject({ url, status: "pending", type: "music", origin: "research" });
    const events = await database.query.artistActivityEvents.findMany();
    expect(events).toEqual([
      expect.objectContaining({
        id: source!.activityId,
        sourceId: source!.id,
        actorUserId: userId,
        trigger: "source_search",
      }),
    ]);
    expect(await database.query.artistIdMappings.findMany()).toEqual([]);
    expect(await save("https://itunes.apple.com/gb/artist/id1513734272")).toBeUndefined();
    expect(await database.query.artistVaultSources.findMany()).toHaveLength(1);
  });
  it.each(["pending", "approved", "rejected"] as const)(
    "preserves the existing %s decision across URL/locale variants",
    async status => {
      await database.insert(schema.artistVaultSources).values({
        artistId,
        url: "https://music.apple.com/artist/1513734272",
        status,
        type: "profile",
        origin: "submission",
      });
      expect(await save()).toBeUndefined();
      expect(await database.query.artistVaultSources.findMany()).toEqual([
        expect.objectContaining({ status, origin: "submission" }),
      ]);
    },
  );
  it.each([
    { owner: "self", id: "42" },
    { owner: "other", id: "1513734272" },
  ])("does not compete with a mapping: %j", async ({ owner, id }) => {
    await database.insert(schema.artistIdMappings).values({
      id: crypto.randomUUID(),
      artistId: owner === "self" ? artistId : otherId,
      platform: "apple_music",
      platformId: id,
    });
    expect(await save()).toBeUndefined();
    expect(await database.query.artistVaultSources.findMany()).toEqual([]);
  });
  it("does not adopt a mapped exclusion or replace an existing manual profile", async () => {
    await client.exec(
      `RESET ROLE; INSERT INTO artist_mapping_exclusions VALUES ('${artistId}', 'apple_music','name_mismatch'); SET ROLE mnweb`,
    );
    expect(await save()).toBeUndefined();
    await client.exec("RESET ROLE; TRUNCATE artist_mapping_exclusions; SET ROLE mnweb");
    await database.insert(schema.artistVaultSources).values({
      artistId,
      url: "https://music.apple.com/artist/42",
      status: "approved",
      origin: "submission",
    });
    expect(await save()).toBeUndefined();
  });
  it.each(["spotify", "deezer"] as const)(
    "does not adopt another artist's canonical %s profile",
    async platform => {
      const id = platform === "spotify" ? "3DmaZbBPnKSGnxYRpHobss" : "123";
      await database
        .update(schema.artists)
        .set({ [platform]: id })
        .where(eq(schema.artists.id, otherId));
      const host = platform === "spotify" ? "open.spotify.com" : "www.deezer.com";
      expect(await save(`https://${host}/artist/${id}`)).toBeUndefined();
      expect(await database.query.artistVaultSources.findMany()).toEqual([]);
    },
  );
  it.each([
    ["bandcamp", "https://dupes.bandcamp.com/"],
    ["subvert", "https://subvert.fm/dupes"],
    ["supercollector", "https://release.supercollector.xyz/artist/dupes"],
    ["soundcloud", "https://soundcloud.com/dupes"],
    ["audius", "https://audius.co/dupes"],
    ["mixcloud", "https://www.mixcloud.com/dupes/"],
  ] as const)("preserves another artist's legacy canonical %s handle", async (platform, url) => {
    await database
      .update(schema.artists)
      .set({ [platform]: platform === "supercollector" ? " @DuPes.ETH " : " @DuPes " })
      .where(eq(schema.artists.id, otherId));
    expect(await save(url)).toBeUndefined();
    expect(await database.query.artistVaultSources.findMany()).toEqual([]);
  });
  it("keeps canonical Spotify IDs case-sensitive", async () => {
    await database
      .update(schema.artists)
      .set({ spotify: "AAAAAAAAAAAAAAAAAAAAAA" })
      .where(eq(schema.artists.id, otherId));
    expect(await save("https://open.spotify.com/artist/aaaaaaaaaaaaaaaaaaaaaa")).toMatchObject({
      type: "music",
      status: "pending",
    });
  });
  it("preserves spoken audio through the actual writer and supports explicitly classified music", async () => {
    const spoken = "https://soundcloud.com/pete-rango/a-conversation";
    const music = "https://soundcloud.com/pete-rango/rush";
    await withArtistOperation(
      artistId,
      { expectedClaimId: claimId, sourceOrigin: "research" },
      async () => {
        await insertVaultSource({
          artistId,
          url: spoken,
          type: "audio",
          title: "Pete Rango interview",
        });
        await insertVaultSource({ artistId, url: music, type: "music", title: "rush" });
      },
    );
    const rows = await database.query.artistVaultSources.findMany();
    expect(rows.find(row => row.url === spoken)?.type).toBe("audio");
    expect(rows.find(row => row.url === music)?.type).toBe("music");
  });
  it("keeps releases distinct from artist identities", async () => {
    await database
      .insert(schema.artistIdMappings)
      .values({ id: crypto.randomUUID(), artistId, platform: "apple_music", platformId: "42" });
    expect(await save("https://music.apple.com/us/album/rush/123?i=456")).toMatchObject({
      type: "music",
      url: "https://music.apple.com/us/album/rush/123?i=456",
    });
  });
  it("rejects revoked ownership and rolls back if attribution cannot be recorded", async () => {
    await database
      .update(schema.artistClaims)
      .set({ status: "rejected" })
      .where(eq(schema.artistClaims.id, claimId));
    await expect(save()).rejects.toThrow();
    expect(await database.query.artistVaultSources.findMany()).toEqual([]);
    await database
      .update(schema.artistClaims)
      .set({ status: "approved" })
      .where(eq(schema.artistClaims.id, claimId));
    await client.exec(
      "RESET ROLE; ALTER TABLE artist_activity_events ADD CONSTRAINT fail_audit CHECK (trigger <> 'source_search'); SET ROLE mnweb",
    );
    try {
      await expect(save()).rejects.toThrow();
      expect(await database.query.artistVaultSources.findMany()).toEqual([]);
    } finally {
      await client.exec(
        "RESET ROLE; ALTER TABLE artist_activity_events DROP CONSTRAINT fail_audit; SET ROLE mnweb",
      );
    }
  });
  it("does not grant browser-role access", async () => {
    await client.exec("SET ROLE anon");
    await expect(database.query.artistVaultSources.findMany()).rejects.toThrow();
  });
});
