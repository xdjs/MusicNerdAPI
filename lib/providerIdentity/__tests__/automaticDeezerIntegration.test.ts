import { readFileSync } from "node:fs";
import { writeArtistLink } from "@/lib/vault/writeArtistLink";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq, type SQL } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, afterEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { withArtistOperation } from "@/lib/ownership/withArtistOperation";
import { applyProfileLinkDecisions } from "@/lib/onboarding/applyProfileLinkDecisions";
import { setArtistLink } from "@/lib/artistLinks/setArtistLink";

// URL parsing, external corroboration and the unused vault route are mocked.
// A PGlite adapter runs the real identity gates, scoped authorization, shared
// writer and cancellation SQL; policies here simulate the mnweb contract.
vi.mock("@/lib/artists/extractArtistId", () => ({
  extractArtistId: async (url: string) =>
    url.includes("spotify")
      ? { siteName: "spotify", id: "A".repeat(22) }
      : { siteName: "deezer", id: "87797542" },
}));
vi.mock("@/lib/onboarding/routeLinkToVault", () => ({ routeLinkToVault: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  get db() {
    return adapter;
  },
}));
const client = new PGlite();
const database = drizzle(client, { schema });
function adapt(executor: Pick<typeof database, "query" | "execute">) {
  return { query: executor.query, execute: async (q: SQL) => (await executor.execute(q)).rows };
}
const adapter = {
  ...adapt(database),
  transaction: (fn: (tx: ReturnType<typeof adapt>) => Promise<unknown>) =>
    database.transaction(tx => fn(adapt(tx))),
};
const artistId = "00000000-0000-4000-8000-000000001580";
const userId = "00000000-0000-4000-8000-000000001581";
const claimId = "00000000-0000-4000-8000-000000001582";
const otherId = "00000000-0000-4000-8000-000000001583";
const spotify = "A".repeat(22);
const url = "https://www.deezer.com/artist/87797542";
const tables = [
  schema.artists,
  schema.users,
  schema.artistClaims,
  schema.artistIdMappings,
  schema.artistMappingExclusions,
  schema.artistVaultSources,
  schema.artistResearchJobs,
];
const run = (automatic = true) =>
  withArtistOperation(artistId, { userId, expectedClaimId: claimId }, () =>
    applyProfileLinkDecisions(
      artistId,
      [{ url }],
      [],
      automatic ? { verifyIdentity: true } : undefined,
    ),
  );
const stored = async () =>
  (await database.select().from(schema.artists).where(eq(schema.artists.id, artistId)))[0];
beforeAll(async () => {
  await client.exec(
    "CREATE TYPE exclusion_reason AS ENUM ('conflict','name_mismatch','too_ambiguous'); CREATE TYPE source_status AS ENUM ('pending','approved','rejected'); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE mnweb; CREATE TYPE confidence_level AS ENUM ('high','medium','low','manual'); CREATE TYPE claim_status AS ENUM ('pending','approved','rejected')",
  );
  for (const table of tables) {
    const config = getTableConfig(table);
    await client.exec(
      `CREATE TABLE "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}`).join(",")}); ALTER TABLE "${config.name}" ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_app ON "${config.name}" TO mnweb USING (true) WITH CHECK (true); GRANT SELECT, INSERT, UPDATE ON "${config.name}" TO mnweb;`,
    );
  }
  await client.exec(`CREATE SCHEMA musicnerd_private; GRANT USAGE ON SCHEMA musicnerd_private TO mnweb;
    CREATE TABLE musicnerd_private.catalog_link_disconnects(artist_id uuid,platform text);
    REVOKE ALL ON musicnerd_private.catalog_link_disconnects FROM PUBLIC,mnweb;`);
  await client.exec(
    readFileSync(
      new URL(
        "../../artistLinks/__tests__/fixtures/0058_catalog_automatic_reconnect_guard.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  // Mirrors the Web-owned unique identity contracts; not full migration replay.
  await client.exec(
    "ALTER TABLE artists ADD PRIMARY KEY (id); ALTER TABLE artist_id_mappings ADD FOREIGN KEY (artist_id) REFERENCES artists(id); CREATE UNIQUE INDEX artists_deezer_uniq ON artists(deezer) WHERE deezer IS NOT NULL; CREATE UNIQUE INDEX artist_id_mappings_platform_id_uniq ON artist_id_mappings(platform,platform_id); CREATE UNIQUE INDEX artist_id_mappings_artist_platform_uniq ON artist_id_mappings(artist_id,platform)",
  );
  await client.exec(
    "ALTER TABLE artist_research_jobs ADD CONSTRAINT artist_research_jobs_kind_check CHECK (kind IN ('social_ingest', 'caption_extract', 'lore_refresh', 'source_search', 'latest_refresh', 'source_extract', 'question_research', 'spotify_match'))",
  );
}, 30000);
beforeEach(async () => {
  await client.exec(
    "RESET ROLE; TRUNCATE artists,users,artist_claims,artist_id_mappings,artist_research_jobs,artist_mapping_exclusions,artist_vault_sources,musicnerd_private.catalog_link_disconnects",
  );
  await database
    .insert(schema.artists)
    .values({ id: artistId, name: "Synthetic stage alias", spotify });
  await database.insert(schema.users).values({ id: userId, isAdmin: false });
  await database
    .insert(schema.artistClaims)
    .values({ id: claimId, artistId, userId, status: "approved" });
  await client.exec(
    `INSERT INTO artist_research_jobs(id,artist_id,kind,status,state) VALUES ('${otherId}','${artistId}','spotify_match','pending','{}')`,
  );
  await client.exec("SET ROLE mnweb");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: {
          bindings: [
            {
              item: { value: "https://www.wikidata.org/entity/Q1" },
              sourceId: { value: spotify },
              targetId: { value: "87797542" },
            },
          ],
        },
      }),
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await client.close();
});
it("runs automatic attachment, RETURNING and cancellation under mnweb with real Drizzle", async () => {
  expect((await client.query("SELECT current_user")).rows).toEqual([{ current_user: "mnweb" }]);
  expect((await run()).written).toEqual(["deezer"]);
  expect((await stored()).deezer).toBe("87797542");
  expect((await client.query("SELECT status,state FROM artist_research_jobs")).rows).toEqual([
    { status: "done", state: { identityChanged: true, outcome: "identity_changed" } },
  ]);
});
it("leaves unmatched guesses unconnected and jobs unchanged", async () => {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ results: { bindings: [] } }),
  } as Response);
  expect((await run()).identityBlocked).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
  expect((await client.query("SELECT status FROM artist_research_jobs")).rows).toEqual([
    { status: "pending" },
  ]);
});
it("preserves explicit confirmation when no corroboration is available", async () => {
  await database
    .update(schema.artists)
    .set({ spotify: null })
    .where(eq(schema.artists.id, artistId));
  expect((await run(false)).written).toEqual(["deezer"]);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects a revoked claim at the actual write and keeps jobs unchanged", async () => {
  await database.update(schema.artistClaims).set({ status: "rejected" });
  expect((await run(false)).writeRejected).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
  expect((await client.query("SELECT status FROM artist_research_jobs")).rows).toEqual([
    { status: "pending" },
  ]);
});
it("retains mapping collisions for explicit confirmations", async () => {
  await database.insert(schema.artists).values({ id: otherId, name: "Other artist" });
  await database.insert(schema.artistIdMappings).values({
    confidence: "manual",
    source: "synthetic-test",
    id: otherId,
    artistId: otherId,
    platform: "deezer",
    platformId: "87797542",
  });
  expect((await run(false)).writeRejected).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
});
it("rejects pre-reset evidence when reset has cleared the Spotify anchor", async () => {
  await database
    .update(schema.artists)
    .set({ spotify: null })
    .where(eq(schema.artists.id, artistId));
  await expect(
    withArtistOperation(artistId, { userId, expectedClaimId: claimId }, () =>
      setArtistLink(artistId, "deezer", "87797542", undefined, undefined, {
        spotifyId: spotify,
        deezerId: "87797542",
        previousDeezerId: null,
      }),
    ),
  ).rejects.toThrow("changed during automatic verification");
  expect((await stored()).deezer).toBeNull();
});

const spotifyUrl = `https://open.spotify.com/artist/${spotify}`;
const runSpotify = (automatic = true) =>
  withArtistOperation(artistId, { userId, expectedClaimId: claimId }, () =>
    applyProfileLinkDecisions(
      artistId,
      [{ url: spotifyUrl }],
      [],
      automatic ? { verifyIdentity: true } : undefined,
    ),
  );
async function seedDeezerAnchor() {
  await database
    .update(schema.artists)
    .set({ spotify: null, deezer: "87797542" })
    .where(eq(schema.artists.id, artistId));
}
it("rejects a generic automatic Spotify guess without reciprocal evidence", async () => {
  await seedDeezerAnchor();
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ results: { bindings: [] } }),
  } as Response);
  expect((await runSpotify()).identityBlocked).toEqual([spotifyUrl]);
  expect((await stored()).spotify).toBeNull();
  expect((await client.query("SELECT status FROM artist_research_jobs")).rows).toEqual([
    { status: "pending" },
  ]);
});
it("writes a corroborated automatic Spotify pair", async () => {
  await seedDeezerAnchor();
  expect((await runSpotify()).written).toEqual(["spotify"]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((await stored()).spotify).toBe(spotify);
});
it("preserves an existing different Spotify account before automatic verification", async () => {
  await seedDeezerAnchor();
  await database.update(schema.artists).set({ spotify: "B".repeat(22) });
  expect((await runSpotify()).identityBlocked).toEqual([spotifyUrl]);
  expect((await stored()).spotify).toBe("B".repeat(22));
});
it("rejects Spotify attachment when the Deezer anchor changes during verification", async () => {
  await seedDeezerAnchor();
  const response = await fetch("intercepted fixture response");
  vi.mocked(fetch).mockImplementationOnce(async () => {
    await database.update(schema.artists).set({ deezer: "1234" });
    return response;
  });
  expect((await runSpotify()).writeRejected).toEqual([spotifyUrl]);
  expect((await stored()).spotify).toBeNull();
});
it("explicit Spotify confirmation still requires an approved claim", async () => {
  await seedDeezerAnchor();
  await database.update(schema.artistClaims).set({ status: "rejected" });
  expect((await runSpotify(false)).writeRejected).toEqual([spotifyUrl]);
  expect((await stored()).spotify).toBeNull();
});
it("explicit Spotify confirmation keeps mapping collision guards", async () => {
  await seedDeezerAnchor();
  await database.insert(schema.artists).values({ id: otherId, name: "Other" });
  await database.insert(schema.artistIdMappings).values({
    confidence: "manual",
    source: "synthetic-test",
    id: otherId,
    artistId: otherId,
    platform: "spotify",
    platformId: spotify,
  });
  expect((await runSpotify(false)).writeRejected).toEqual([spotifyUrl]);
  expect((await stored()).spotify).toBeNull();
});
it("explicit Spotify confirmation can write without an automatic anchor", async () => {
  await database.update(schema.artists).set({ spotify: null, deezer: null });
  expect((await runSpotify(false)).written).toEqual(["spotify"]);
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["spotify", "deezer"])("research adoption cannot bypass %s corroboration", async site => {
  if (site === "spotify") await seedDeezerAnchor();
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ results: { bindings: [] } }),
  } as Response);
  const record = { spotify: null, deezer: null };
  const provisional = new Set([site]);
  await expect(
    withArtistOperation(artistId, { userId, expectedClaimId: claimId }, () =>
      writeArtistLink(
        artistId,
        site,
        site === "spotify" ? spotify : "87797542",
        provisional,
        record,
      ),
    ),
  ).rejects.toThrow("Automatic catalog identity not corroborated");
  expect(record).toEqual({ spotify: null, deezer: null });
  expect(provisional.has(site)).toBe(true);
});

it("keeps an intervening Spotify owner choice instead of overwriting it", async () => {
  await seedDeezerAnchor();
  const response = await fetch("intercepted fixture response");
  vi.mocked(fetch).mockImplementationOnce(async () => {
    await database.update(schema.artists).set({ spotify: "B".repeat(22) });
    return response;
  });
  expect((await runSpotify()).writeRejected).toEqual([spotifyUrl]);
  expect((await stored()).spotify).toBe("B".repeat(22));
});
it.each(["spotify", "deezer"])(
  "does not bootstrap an automatic %s identity without an anchor",
  async site => {
    await database.update(schema.artists).set({ spotify: null, deezer: null });
    expect((await (site === "spotify" ? runSpotify() : run())).written).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("reconstructed Rnd1/RNDN candidate stays unconnected when pair evidence conflicts (synthetic anchor)", async () => {
  // Saved incident supplies Rnd1, RNDN and Deezer 87797542; original write/Spotify evidence is unavailable.
  await database.update(schema.artists).set({ name: "Rnd1" });
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      results: {
        bindings: [
          {
            item: { value: "https://www.wikidata.org/entity/Q1" },
            sourceId: { value: "B".repeat(22) },
            targetId: { value: "87797542" },
          },
        ],
      },
    }),
  } as Response);
  expect((await run()).identityBlocked).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
});
it.each(["spotify", "deezer"])(
  "research %s adoption passes evidence to the real writer",
  async site => {
    if (site === "spotify") await seedDeezerAnchor();
    const record: Record<string, unknown> = {};
    const provisional = new Set([site]);
    const value = site === "spotify" ? spotify : "87797542";
    await withArtistOperation(artistId, { userId, expectedClaimId: claimId }, () =>
      writeArtistLink(artistId, site, value, provisional, record),
    );
    expect(record[site]).toBe(value);
    expect(provisional.has(site)).toBe(false);
    expect((await stored())[site as "spotify" | "deezer"]).toBe(value);
  },
);

it("does not reattach a retained own mapping without fresh pair evidence", async () => {
  await database.insert(schema.artistIdMappings).values({
    id: otherId,
    artistId,
    platform: "deezer",
    platformId: "87797542",
    confidence: "manual",
    source: "synthetic-test",
  });
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ results: { bindings: [] } }),
  } as Response);
  expect((await run()).identityBlocked).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
  expect((await client.query("SELECT platform_id FROM artist_id_mappings")).rows).toEqual([
    { platform_id: "87797542" },
  ]);
  expect((await client.query("SELECT status FROM artist_research_jobs")).rows).toEqual([
    { status: "pending" },
  ]);
});

it("does not restore an explicitly excluded catalog after successful corroboration", async () => {
  await client.exec(
    `INSERT INTO artist_mapping_exclusions(artist_id,platform,reason) VALUES ('${artistId}','deezer','conflict')`,
  );
  expect((await run()).writeRejected).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
});

it("refuses automatic reconnection after a normal archived disconnect, but preserves explicit confirmation", async () => {
  await client.exec(
    `RESET ROLE; INSERT INTO musicnerd_private.catalog_link_disconnects VALUES ('${artistId}','deezer'); SET ROLE mnweb`,
  );
  expect((await run()).writeRejected).toEqual([url]);
  expect((await stored()).deezer).toBeNull();
  expect((await run(false)).written).toEqual(["deezer"]);
});
