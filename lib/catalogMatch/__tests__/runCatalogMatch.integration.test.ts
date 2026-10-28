import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { ResearchJob } from "@/lib/research/types";
import { runCatalogMatch } from "../runCatalogMatch";
const m = vi.hoisted(() => ({ resolve: vi.fn(), cooldown: vi.fn() }));
vi.mock("@/lib/musicPlatform/resolveCatalogCounterpart", () => ({
  resolveCatalogCounterpart: m.resolve,
}));
vi.mock("@/lib/spotify/checkSpotifyCooldown", () => ({ checkSpotifyCooldown: m.cooldown }));
vi.mock("@/lib/db/db", () => ({
  get db() {
    return adapter;
  },
}));
const client = new PGlite();
const database = drizzle(client, { schema });
function adapt(tx: Pick<typeof database, "query" | "execute" | "select" | "delete" | "update">) {
  return {
    query: tx.query,
    select: tx.select.bind(tx),
    delete: tx.delete.bind(tx),
    update: tx.update.bind(tx),
    execute: async (q: SQL) => (await tx.execute(q)).rows,
  };
}
const adapter = {
  ...adapt(database),
  transaction: (fn: (tx: ReturnType<typeof adapt>) => Promise<unknown>) =>
    database.transaction(tx => fn(adapt(tx))),
};
const id = "11111111-1111-4111-8111-111111111111",
  spotify = "A".repeat(22),
  deezer = "42";
beforeAll(async () => {
  await client.exec(
    "CREATE ROLE mnweb; CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA musicnerd_private; GRANT USAGE ON SCHEMA musicnerd_private TO mnweb; CREATE TYPE confidence_level AS ENUM('high','medium','low','manual'); CREATE TYPE exclusion_reason AS ENUM('too_ambiguous','name_mismatch','conflict'); CREATE TYPE source_status AS ENUM('pending','approved','rejected'); CREATE TABLE musicnerd_private.catalog_link_disconnects(artist_id uuid,platform text)",
  );
  for (const table of [
    schema.artists,
    schema.artistIdMappings,
    schema.artistMappingExclusions,
    schema.artistVaultSources,
    schema.artistResearchJobs,
    schema.artistSocialPosts,
    schema.artistDocs,
    schema.artistOnboardingSteps,
  ]) {
    const config = getTableConfig(table);
    await client.exec(
      `CREATE TABLE "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}`).join(",")}); GRANT SELECT,INSERT,UPDATE ON "${config.name}" TO mnweb`,
    );
  }
  await client.exec(
    "ALTER TABLE artists ADD PRIMARY KEY(id); ALTER TABLE artist_research_jobs ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN attempts SET DEFAULT 0, ALTER COLUMN cursor SET DEFAULT 0, ALTER COLUMN created_at SET DEFAULT now(), ALTER COLUMN updated_at SET DEFAULT clock_timestamp(); ALTER TABLE artist_research_jobs ADD CONSTRAINT artist_research_jobs_kind_check CHECK(kind IN('spotify_match')); CREATE UNIQUE INDEX artist_research_jobs_one_live ON artist_research_jobs(artist_id,kind) WHERE status IN('pending','running')",
  );
  for (const path of [
    "../../artistLinks/__tests__/fixtures/0058_catalog_automatic_reconnect_guard.sql",
    "./fixtures/0059_catalog_counterpart_jobs.sql",
  ])
    await client.exec(readFileSync(new URL(path, import.meta.url), "utf8"));
}, 30000);
beforeEach(async () => {
  await client.exec(
    "RESET ROLE; TRUNCATE artists,artist_research_jobs,artist_id_mappings,artist_mapping_exclusions,artist_vault_sources,musicnerd_private.catalog_link_disconnects",
  );
  m.resolve
    .mockReset()
    .mockResolvedValue({ status: "verified", spotifyId: spotify, deezerId: deezer, recordings: 2 });
  m.cooldown.mockReset().mockResolvedValue(undefined);
});
afterAll(async () => {
  await client.close();
});
async function start(reverse = false) {
  await client.query("INSERT INTO artists(id,name,spotify,deezer) VALUES($1,$2,$3,$4)", [
    id,
    "Artist",
    reverse ? null : spotify,
    reverse ? deezer : null,
  ]);
  await client.exec("SET ROLE mnweb");
  return claim();
}
async function claim() {
  const { rows } = await client.query<Record<string, unknown>>(
    "UPDATE artist_research_jobs SET status='running',claimed_at=now(),updated_at=clock_timestamp() WHERE status='pending' RETURNING *,updated_at::text AS lease",
  );
  const r = rows[0];
  return { ...r, artistId: r.artist_id, updatedAt: r.lease, activityId: null } as ResearchJob;
}
async function state() {
  return (
    await client.query<{ status: string; state: Record<string, unknown>; attempts: number }>(
      "SELECT status,state,attempts FROM artist_research_jobs ORDER BY created_at",
    )
  ).rows;
}
async function artist() {
  return (await client.query("SELECT spotify,deezer FROM artists")).rows[0];
}
for (const reverse of [false, true])
  it(`attaches a verified ${reverse ? "Spotify" : "Deezer"} counterpart once without recursion`, async () => {
    const job = await start(reverse);
    expect((await runCatalogMatch(job, Date.now() + 30000)).done).toBe(true);
    expect(await artist()).toEqual({ spotify, deezer });
    expect(await state()).toMatchObject([{ status: "done", state: { outcome: "verified" } }]);
    await runCatalogMatch(job, Date.now() + 30000);
    expect(m.resolve).toHaveBeenCalledTimes(1);
  });
for (const outcome of ["not_found", "ambiguous"])
  it(`persists ${outcome} without inventing a link or replaying`, async () => {
    const job = await start();
    m.resolve.mockResolvedValue({ status: outcome });
    await runCatalogMatch(job, Date.now() + 30000);
    expect(await artist()).toEqual({ spotify, deezer: null });
    expect(await state()).toMatchObject([{ status: "done", state: { outcome } }]);
    await client.exec("UPDATE artists SET bio='enriched again'");
    expect(await state()).toHaveLength(1);
  });
it("bounds provider failures, retains distinct failure state and defers retries", async () => {
  let job = await start();
  m.resolve.mockResolvedValue({ status: "provider_failure" });
  for (let i = 0; i < 4; i++) {
    await runCatalogMatch(job, Date.now() + 30000);
    if (i < 3) {
      expect(await state()).toMatchObject([{ status: "pending", attempts: i + 1 }]);
      job = await claim();
    }
  }
  expect(await state()).toMatchObject([
    { status: "failed", attempts: 4, state: { outcome: "provider_failure" } },
  ]);
  expect(await artist()).toEqual({ spotify, deezer: null });
});
it("respects a disconnect arriving during provider verification", async () => {
  const job = await start();
  m.resolve.mockImplementation(async () => {
    await client.exec("RESET ROLE");
    await client.query("INSERT INTO musicnerd_private.catalog_link_disconnects VALUES($1,$2)", [
      id,
      "deezer",
    ]);
    await client.exec("SET ROLE mnweb");
    return { status: "verified", spotifyId: spotify, deezerId: deezer, recordings: 2 };
  });
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer: null });
  expect(await state()).toMatchObject([{ state: { outcome: "user_disconnected" } }]);
});
it("retains machine/unknown exclusions while recording newly verified evidence for review", async () => {
  const job = await start();
  await client.query(
    "INSERT INTO artist_mapping_exclusions(artist_id,platform,reason) VALUES($1,'deezer','too_ambiguous')",
    [id],
  );
  await runCatalogMatch(job, Date.now() + 30000);
  expect(m.resolve).toHaveBeenCalledTimes(1);
  expect(await artist()).toEqual({ spotify, deezer: null });
  expect(await state()).toMatchObject([
    {
      state: {
        outcome: "exclusion_review_required",
        result: { spotifyId: spotify, deezerId: deezer },
      },
    },
  ]);
  expect((await client.query("SELECT * FROM artist_mapping_exclusions")).rows).toHaveLength(1);
});
it("does not overwrite a concurrent source identity edit or the replacement job", async () => {
  const job = await start();
  m.resolve.mockImplementation(async () => {
    await client.exec("UPDATE artists SET spotify='BBBBBBBBBBBBBBBBBBBBBB'");
    return { status: "verified", spotifyId: spotify, deezerId: deezer, recordings: 2 };
  });
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify: "B".repeat(22), deezer: null });
  expect((await state()).filter(j => j.status === "pending")).toHaveLength(1);
  expect((await state()).find(j => j.status === "done")?.state.outcome).toBe("identity_changed");
});
it("keeps provider work out of a short slice and waits for the legacy worker", async () => {
  const job = await start();
  await runCatalogMatch(job, Date.now() + 100);
  expect(m.resolve).not.toHaveBeenCalled();
  const next = await claim();
  await client.query(
    "INSERT INTO artist_research_jobs(artist_id,kind,status,state) VALUES($1,'spotify_match','pending','{}')",
    [id],
  );
  await runCatalogMatch(next, Date.now() + 30000);
  expect(m.resolve).not.toHaveBeenCalled();
});

it("a shared cooldown defers without consuming failure budget or calling providers", async () => {
  const { SpotifyDeferredError } = await import("@/lib/spotify/SpotifyDeferredError");
  const job = await start();
  m.cooldown.mockRejectedValue(new SpotifyDeferredError(Date.now() + 120000, false));
  await runCatalogMatch(job, Date.now() + 30000);
  expect(m.resolve).not.toHaveBeenCalled();
  expect(await state()).toMatchObject([{ status: "pending", attempts: 0 }]);
});
it("retains a concurrent explicit target choice", async () => {
  const job = await start();
  m.resolve.mockImplementation(async () => {
    await client.exec("UPDATE artists SET deezer='99'");
    return { status: "verified", spotifyId: spotify, deezerId: deezer, recordings: 2 };
  });
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer: "99" });
});
it("preserves conflicting retained mappings and malformed historical IDs for review", async () => {
  const job = await start();
  await client.query(
    "INSERT INTO artist_id_mappings(artist_id,platform,platform_id) VALUES($1,'deezer','no_match')",
    [id],
  );
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer: null });
  expect(await state()).toMatchObject([{ state: { outcome: "review_required" } }]);
});
it("expires a stuck job without provider calls", async () => {
  const job = await start();
  job.state.expiresAtMs = Date.now() - 1;
  await runCatalogMatch(job, Date.now() + 30000);
  expect(m.resolve).not.toHaveBeenCalled();
  expect(await state()).toMatchObject([{ status: "failed", state: { outcome: "expired" } }]);
});

it("classifies neither-provider profiles without fabricating name-only identities", async () => {
  await client.query("INSERT INTO artists(id,name) VALUES($1,$2)", [id, "Artist"]);
  await client.exec("SET ROLE mnweb");
  const job = await claim();
  await runCatalogMatch(job, Date.now() + 30000);
  expect(m.resolve).not.toHaveBeenCalled();
  expect(await state()).toMatchObject([
    { status: "done", state: { outcome: "identity_anchor_required" } },
  ]);
  expect(await artist()).toEqual({ spotify: null, deezer: null });
});

it("the real reset preserves catalog work and queues recovery for legacy one-sided rows", async () => {
  const { resetClaimBuild } = await import("@/lib/claimBuild/resetClaimBuild");
  await client.exec("ALTER TABLE artists DISABLE TRIGGER artists_catalog_counterpart");
  await client.query("INSERT INTO artists(id,name,spotify,bio) VALUES($1,$2,$3,$4)", [
    id,
    "Artist",
    spotify,
    "old bio",
  ]);
  await client.exec("ALTER TABLE artists ENABLE TRIGGER artists_catalog_counterpart");
  expect(await state()).toHaveLength(0);
  await resetClaimBuild(id);
  expect(await state()).toMatchObject([{ status: "pending" }]);
  await resetClaimBuild(id);
  expect(await state()).toHaveLength(1);
  const job = await claim();
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer });
});

it("the shared explicit API writer queues counterpart discovery after an anchor is supplied", async () => {
  const { setArtistLink } = await import("@/lib/artistLinks/setArtistLink");
  await client.query("INSERT INTO artists(id,name) VALUES($1,$2)", [id, "Artist"]);
  await runCatalogMatch(await claim(), Date.now() + 30000);
  await setArtistLink(id, "spotify", spotify);
  const job = await claim();
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer });
  expect((await state()).filter(j => j.state.outcome === "verified")).toHaveLength(1);
});

it("the actual shared claimer honors catalog backoff before reclaiming the job", async () => {
  const { claimResearchJob } = await import("@/lib/research/claimResearchJob");
  const job = await start();
  m.resolve.mockResolvedValue({ status: "provider_failure" });
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await claimResearchJob({ kinds: ["catalog_match"], artistId: id })).toBeNull();
  await client.exec(
    "UPDATE artist_research_jobs SET state=jsonb_set(state,'{nextAttemptAtMs}','0')",
  );
  expect(await claimResearchJob({ kinds: ["catalog_match"], artistId: id })).toMatchObject({
    kind: "catalog_match",
    status: "running",
    attempts: 1,
  });
});

it("a newly recorded exclusion during verification takes priority over a positive match", async () => {
  const job = await start();
  m.resolve.mockImplementation(async () => {
    await client.query(
      "INSERT INTO artist_mapping_exclusions(artist_id,platform,reason) VALUES($1,'deezer','conflict')",
      [id],
    );
    return { status: "verified", spotifyId: spotify, deezerId: deezer, recordings: 2 };
  });
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer: null });
  expect(await state()).toMatchObject([{ state: { outcome: "exclusion_review_required" } }]);
});

it("uses an already approved matching catalog source without treating it as a rejection", async () => {
  const job = await start();
  await client.query(
    "INSERT INTO artist_vault_sources(artist_id,url,status) VALUES($1,$2,'approved')",
    [id, `https://www.deezer.com/artist/${deezer}`],
  );
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer });
});
it("preserves a rejected exact catalog source even after a positive provider match", async () => {
  const job = await start();
  await client.query(
    "INSERT INTO artist_vault_sources(artist_id,url,status) VALUES($1,$2,'rejected')",
    [id, `https://www.deezer.com/artist/${deezer}`],
  );
  await runCatalogMatch(job, Date.now() + 30000);
  expect(await artist()).toEqual({ spotify, deezer: null });
  expect(await state()).toMatchObject([{ state: { outcome: "review_required" } }]);
});
it("allows only one catalog worker globally and reclaims its expired lease", async () => {
  const { claimResearchJob } = await import("@/lib/research/claimResearchJob");
  await client.query(
    "INSERT INTO artists(id,name,spotify) VALUES($1,'First',$2),($3,'Second',$2)",
    [id, spotify, "22222222-2222-4222-8222-222222222222"],
  );
  const first = await claimResearchJob({ kinds: ["catalog_match"] });
  expect(first).not.toBeNull();
  expect(await claimResearchJob({ kinds: ["catalog_match"] })).toBeNull();
  await client.query(
    "UPDATE artist_research_jobs SET claimed_at=now()-interval '1 hour' WHERE id=$1",
    [first!.id],
  );
  expect((await claimResearchJob({ kinds: ["catalog_match"] }))?.id).toBe(first!.id);
});
