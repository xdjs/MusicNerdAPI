/** Opt-in synthetic local PostgreSQL only. MUSICNERD_MATCH_TEST_PORT=55442 pnpm test spotifyMatch.integration */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getTableConfig } from "drizzle-orm/pg-core";
import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";
import { lockArtistRow } from "@/lib/db/lockArtistRow";
import { randomUUID } from "node:crypto";
import * as schema from "@/lib/db/schema";
import type { ResearchJob } from "@/lib/research/types";
import type { SpotifyMatchState } from "../types";
import { spotifyMatchEligible } from "../spotifyMatchEligible";
import { attachSpotifyMatch } from "../attachSpotifyMatch";
import { readFileSync, realpathSync } from "node:fs";
import { sql } from "drizzle-orm";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { recordSpotifyCooldown } from "@/lib/spotify/recordSpotifyCooldown";
import { spotifyCooldownKey } from "@/lib/spotify/spotifyCooldownKey";
import { checkSpotifyCooldown } from "@/lib/spotify/checkSpotifyCooldown";
import { advanceResearch } from "@/lib/research/advanceResearch";
import { claimResearchJob } from "@/lib/research/claimResearchJob";
const shared = vi.hoisted(() => ({ database: null as unknown }));
vi.mock("@/lib/db/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const database = shared.database as Record<PropertyKey, unknown>;
        const value = database[key];
        return typeof value === "function" ? value.bind(database) : value;
      },
    },
  ),
}));

const port = process.env.MUSICNERD_MATCH_TEST_PORT;
describe.skipIf(!port)("durable identity SQL on disposable local PostgreSQL", () => {
  let admin: ReturnType<typeof postgres>,
    client: ReturnType<typeof postgres>,
    database: ReturnType<typeof drizzle<typeof schema>>;
  const dbname = `spotify_match_${process.pid}`;
  beforeAll(async () => {
    expect(Number(port)).toBeGreaterThan(1024);
    admin = postgres({
      host: "127.0.0.1",
      port: Number(port),
      database: "postgres",
      username: process.env.USER,
      max: 1,
    });
    const [location] = await admin`select current_setting('data_directory') as path`;
    expect([
      "/private/tmp/mn-spotify-match-local/cluster",
      "/private/tmp/mn-1580-disconnect-postgres/cluster",
    ]).toContain(realpathSync(location.path));
    await admin.unsafe(`create database ${dbname}`);
    client = postgres({
      host: "127.0.0.1",
      port: Number(port),
      database: dbname,
      username: process.env.USER,
      max: 3,
      prepare: false,
    });
    database = drizzle(client, { schema });
    shared.database = database;
    for (const role of ["mnweb", "anon", "authenticated"]) {
      const exists = await client`select 1 from pg_roles where rolname=${role}`;
      if (!exists.length) await client.unsafe(`create role ${role}`);
    }
    await client`create type confidence_level as enum ('high','medium','low','manual')`;
    await client`create type source_status as enum ('pending','approved','rejected')`;
    await client`create type claim_status as enum ('pending','approved','rejected')`;
    for (const table of [
      schema.artists,
      schema.users,
      schema.artistActivityEvents,
      schema.artistIdMappings,
      schema.artistVaultSources,
      schema.artistSocialPosts,
      schema.artistClaims,
      schema.artistResearchJobs,
    ]) {
      const config = getTableConfig(table);
      await client.unsafe(
        `create table "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}`).join(",")})`,
      );
    }
    const migrationConnection = await client.reserve();
    try {
      await migrationConnection.unsafe(
        readFileSync(
          new URL(
            "../../artistLinks/__tests__/fixtures/0056_catalog_disconnect.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    } finally {
      migrationConnection.release();
    }
    await client`alter table artist_activity_events alter column id set default gen_random_uuid()`;
    await client`create table artist_mapping_exclusions(artist_id uuid,platform text,reason text)`;
    await client`create table artist_self_edits(artist_id uuid,site_name text,created_at timestamptz)`;
    await client`create table provider_request_cooldowns(provider_key text primary key,blocked_until timestamptz not null,updated_at timestamptz not null default now())`;
  });
  afterAll(async () => {
    await client?.end();
    if (admin) {
      await admin.unsafe(`drop database if exists ${dbname}`);
      await admin.end();
    }
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  async function fixture() {
    const artistId = randomUUID(),
      event = randomUUID(),
      id = randomUUID(),
      user = randomUUID();
    const state: SpotifyMatchState = {
      version: 1,
      purpose: "spotify_identity",
      deezerId: String(Math.floor(Math.random() * 1e9) + 1),
      artistName: "The Ellis Court",
      creationActivityId: event,
      directoryActivityId: event,
      expiresAtMs: Date.now() + 86400000,
    };
    await client`insert into artists(id,name,deezer,added_by,bio) values(${artistId},${state.artistName},${state.deezerId},${user},'Private artist words unchanged')`;
    await client`insert into artist_activity_events(id,artist_id,actor_user_id,actor_kind,action,trigger) values(${event},${artistId},${user},'user','directory_add','directory_add')`;
    const [row] =
      await client`insert into artist_research_jobs(id,artist_id,kind,status,attempts,cursor,activity_id,state,created_at,updated_at)
      values(${id},${artistId},'spotify_match','running',0,0,${event},${JSON.stringify(state)}::jsonb,now(),clock_timestamp()) returning updated_at::text as lease`;
    const job: ResearchJob = {
      id,
      artistId,
      kind: "spotify_match",
      status: "running",
      attempts: 0,
      cursor: 0,
      total: null,
      activityId: event,
      updatedAt: row.lease,
      state,
    };
    return { job, state };
  }
  it("keeps public matching authorized when a claim arrives, attaches once and preserves About", async () => {
    const { job, state } = await fixture();
    await client`insert into artist_claims(id,artist_id,user_id,status) values(${randomUUID()},${job.artistId},${randomUUID()},'approved')`;
    expect(await spotifyMatchEligible(job, state)).toBe(true);
    expect(await attachSpotifyMatch(job, state, "AAAAAAAAAAAAAAAAAAAAAA")).toBe(true);
    expect(await attachSpotifyMatch(job, state, "BBBBBBBBBBBBBBBBBBBBBB")).toBe(false);
    const [artist] = await client`select spotify,bio from artists where id=${job.artistId}`;
    expect(artist).toMatchObject({
      spotify: "AAAAAAAAAAAAAAAAAAAAAA",
      bio: "Private artist words unchanged",
    });
    const [saved] = await client`select status,state from artist_research_jobs where id=${job.id}`;
    expect(saved.status).toBe("done");
    expect(saved.state.outcome).toBe("matched");
  });
  async function claimant(artistId: string) {
    const userId = randomUUID(),
      claimId = randomUUID();
    await client`insert into users(id,is_admin,is_white_listed) values(${userId},false,false)`;
    await client`insert into artist_claims(id,artist_id,user_id,status) values(${claimId},${artistId},${userId},'approved')`;
    return { userId, claimId };
  }
  async function disconnectEmptySpotify(
    tx: Parameters<Parameters<typeof database.transaction>[0]>[0],
    artistId: string,
    actor: { userId: string; claimId: string },
  ) {
    // The real private primitive independently checks actor, claim, empty slot,
    // exact absent mapping and cancellation under the shared identity locks.
    await tx.execute(
      sql`SELECT musicnerd_private.disconnect_catalog_link(${artistId}::uuid,'spotify',NULL,NULL,${actor.userId}::uuid,${actor.claimId}::uuid,'owner')`,
    );
  }
  it("does not recreate a manually removed Spotify slot, even when it was empty", async () => {
    const { job, state } = await fixture();
    const actor = await claimant(job.artistId);
    await database.transaction(tx => disconnectEmptySpotify(tx, job.artistId, actor));
    expect(await spotifyMatchEligible(job, state)).toBe(false);
    expect(await attachSpotifyMatch(job, state, "CCCCCCCCCCCCCCCCCCCCCC")).toBe(false);
    const [saved] = await client`select status,state from artist_research_jobs where id=${job.id}`;
    expect(saved.state.identityChanged).toBe(true);
    expect(saved.status).toBe("done");
  });
  it("rejects changed Deezer/name, existing Spotify, exclusions, prior edits and rejected links", async () => {
    for (const scenario of [
      "deezer",
      "name",
      "spotify",
      "exclusion",
      "self_edit",
      "rejected_source",
    ]) {
      const { job, state } = await fixture();
      if (scenario === "deezer")
        await client`update artists set deezer='987654321' where id=${job.artistId}`;
      if (scenario === "name")
        await client`update artists set name='Different Artist' where id=${job.artistId}`;
      if (scenario === "spotify")
        await client`update artists set spotify='CCCCCCCCCCCCCCCCCCCCCC' where id=${job.artistId}`;
      if (scenario === "exclusion")
        await client`insert into artist_mapping_exclusions values(${job.artistId},'spotify','too_ambiguous')`;
      if (scenario === "self_edit")
        await client`insert into artist_self_edits values(${job.artistId},'spotify',clock_timestamp())`;
      if (scenario === "rejected_source")
        await client`insert into artist_vault_sources(id,artist_id,url,status) values(${randomUUID()},${job.artistId},'https://open.spotify.com/artist/CCCCCCCCCCCCCCCCCCCCCC','rejected')`;
      expect(await spotifyMatchEligible(job, state), scenario).toBe(false);
    }
  });
  it("guards foreign ownership, a stale lease and changed-then-restored identities", async () => {
    const first = await fixture(),
      second = await fixture();
    await client`update artists set spotify='DDDDDDDDDDDDDDDDDDDDDD' where id=${first.job.artistId}`;
    expect(await attachSpotifyMatch(second.job, second.state, "DDDDDDDDDDDDDDDDDDDDDD")).toBe(
      false,
    );
    await database.transaction(tx =>
      writeArtistLinkColumn(tx, second.job.artistId, "deezer", "5555"),
    );
    await client`update artists set deezer=${second.state.deezerId} where id=${second.job.artistId}`;
    expect(await spotifyMatchEligible(second.job, second.state)).toBe(false);
    const third = await fixture();
    await client`update artist_research_jobs set updated_at=clock_timestamp() where id=${third.job.id}`;
    expect(await attachSpotifyMatch(third.job, third.state, "EEEEEEEEEEEEEEEEEEEEEE")).toBe(false);
  });
  it("lets a concurrent manual removal cancel final attachment under the same locks", async () => {
    const { job, state } = await fixture();
    const actor = await claimant(job.artistId);
    let unlock!: () => void;
    let acquired!: () => void;
    const release = new Promise<void>(resolve => {
      unlock = resolve;
    });
    const ready = new Promise<void>(resolve => {
      acquired = resolve;
    });
    const edit = database.transaction(async tx => {
      await acquireArtistPlatformLock(tx, job.artistId, "spotify");
      await lockArtistRow(tx, job.artistId);
      acquired();
      await release;
      await disconnectEmptySpotify(tx, job.artistId, actor);
    });
    await ready;
    const matching = attachSpotifyMatch(job, state, "FFFFFFFFFFFFFFFFFFFFFF");
    unlock();
    await edit;
    expect(await matching).toBe(false);
    const [artist] = await client`select spotify from artists where id=${job.artistId}`;
    expect(artist.spotify).toBeNull();
  });
  it("honors durable scheduling without reclaiming a cooling job", async () => {
    const { job, state } = await fixture();
    const future = Date.now() + 3600000;
    await client`update artist_research_jobs set status='pending',state=${JSON.stringify({ ...state, nextAttemptAtMs: future })}::jsonb where id=${job.id}`;
    expect(await claimResearchJob({ kinds: ["spotify_match"], artistId: job.artistId })).toBeNull();
    await client`update artist_research_jobs set state=${JSON.stringify({ ...state, nextAttemptAtMs: Date.now() - 1000 })}::jsonb where id=${job.id}`;
    const claimed = await claimResearchJob({ kinds: ["spotify_match"], artistId: job.artistId });
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.attempts).toBe(0);
  });
  it("reclaims an exhausted interrupted match only so the runner can close it without provider work", async () => {
    const { job } = await fixture();
    await client`update artist_research_jobs set attempts=4,claimed_at=now()-interval '10 minutes' where id=${job.id}`;
    const claimed = await claimResearchJob({ kinds: ["spotify_match"], artistId: job.artistId });
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.attempts).toBe(5);
  });
  it("resumes real worker checkpoints after a provider 429 and attaches only after two distinct ISRCs", async () => {
    vi.stubEnv("SPOTIFY_WEB_CLIENT_ID", "local-worker-fixture");
    vi.stubEnv("SPOTIFY_WEB_CLIENT_SECRET", "synthetic-secret");
    const { job } = await fixture();
    await client`update artist_research_jobs set status='pending' where id=${job.id}`;
    const spotifyId = "GGGGGGGGGGGGGGGGGGGGGG";
    const isrcs = ["USAAA2600001", "USAAA2600002"];
    let limited = false;
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        requests.push(url.href);
        if (url.hostname === "api.deezer.com" && url.pathname.endsWith("/top"))
          return Response.json({ data: [{ id: 11 }, { id: 22 }] });
        if (url.hostname === "api.deezer.com" && url.pathname === "/track/11")
          return Response.json({ id: 11, isrc: isrcs[0] });
        if (url.hostname === "api.deezer.com" && url.pathname === "/track/22")
          return Response.json({ id: 22, isrc: isrcs[1] });
        if (url.hostname === "accounts.spotify.com")
          return Response.json({ access_token: "synthetic-token" });
        if (url.hostname === "api.spotify.com" && url.pathname === "/v1/search") {
          if (!limited) {
            limited = true;
            return new Response(null, { status: 429, headers: { "Retry-After": "2" } });
          }
          return Response.json({
            tracks: {
              items: [
                {
                  external_ids: { isrc: url.searchParams.get("q")?.slice(5) },
                  artists: [{ id: spotifyId, name: "The Ellis Court" }],
                },
              ],
            },
          });
        }
        throw new Error(`Unexpected synthetic request: ${url.href}`);
      }),
    );
    const advance = () =>
      advanceResearch({ budgetMs: 20000, kinds: ["spotify_match"], artistId: job.artistId });
    const read = async () =>
      (await client`select status,attempts,state from artist_research_jobs where id=${job.id}`)[0];
    for (const cursor of [0, 1, 2]) {
      expect(await advance()).toMatchObject({ ran: true, done: false });
      expect((await read()).state.trackCursor).toBe(cursor);
    }
    expect((await read()).state.isrcs).toEqual(isrcs);
    expect(await advance()).toMatchObject({ ran: true, done: false, waiting: true });
    const deferred = await read();
    expect(deferred).toMatchObject({ status: "pending", attempts: 1 });
    expect(deferred.state.matches).toEqual([]);
    expect(deferred.state.nextAttemptAtMs).toBeGreaterThan(Date.now());
    const [cooldown] =
      await client`select extract(epoch from blocked_until)*1000 as until from provider_request_cooldowns where blocked_until>now()`;
    expect(Number(cooldown.until)).toBe(deferred.state.nextAttemptAtMs);
    const count = requests.length;
    expect(await advance()).toEqual({ ran: false });
    expect(requests).toHaveLength(count);
    // A different eligible job observes the same app-wide delay without calling either provider.
    const other = await fixture();
    await client`update artist_research_jobs set status='pending' where id=${other.job.id}`;
    expect(
      await advanceResearch({
        budgetMs: 20000,
        kinds: ["spotify_match"],
        artistId: other.job.artistId,
      }),
    ).toMatchObject({ waiting: true });
    expect(requests).toHaveLength(count);
    const [otherSaved] =
      await client`select attempts from artist_research_jobs where id=${other.job.id}`;
    expect(otherSaved.attempts).toBe(0);
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(0, deferred.state.nextAttemptAtMs - Date.now()) + 30),
    );
    expect(await advance()).toMatchObject({ ran: true, done: false });
    expect((await read()).state.matches).toHaveLength(1);
    expect(
      (await client`select spotify from artists where id=${job.artistId}`)[0].spotify,
    ).toBeNull();
    expect(await advance()).toMatchObject({ ran: true, done: false });
    expect((await read()).state.matches.map((match: { isrc: string }) => match.isrc)).toEqual(
      isrcs,
    );
    const beforeAttach = requests.length;
    expect(await advance()).toMatchObject({ ran: true, done: true });
    expect(requests).toHaveLength(beforeAttach);
    expect(await read()).toMatchObject({
      status: "done",
      attempts: 1,
      state: { outcome: "matched" },
    });
    expect((await client`select spotify,bio from artists where id=${job.artistId}`)[0]).toEqual({
      spotify: spotifyId,
      bio: "Private artist words unchanged",
    });
    expect(requests.filter(url => url.includes("api.deezer.com"))).toHaveLength(3);
    expect(
      requests
        .filter(url => url.includes("/v1/search"))
        .map(url => new URL(url).searchParams.get("q")),
    ).toEqual([`isrc:${isrcs[0]}`, `isrc:${isrcs[0]}`, `isrc:${isrcs[1]}`]);
  });
  it("does not let concurrent shorter Retry-After replies shorten the shared deadline", async () => {
    vi.stubEnv("SPOTIFY_WEB_CLIENT_ID", "local-shared-fixture");
    const start = Date.now();
    await Promise.all([
      recordSpotifyCooldown("3600"),
      recordSpotifyCooldown("60"),
      recordSpotifyCooldown("120"),
    ]);
    const [row] =
      await client`select extract(epoch from blocked_until)*1000 as until from provider_request_cooldowns where provider_key=${spotifyCooldownKey()}`;
    expect(Number(row.until)).toBeGreaterThanOrEqual(start + 3600000);
    await expect(checkSpotifyCooldown()).rejects.toMatchObject({ status: 429, requested: false });
    await client`update provider_request_cooldowns set blocked_until=now()-interval '1 second'`;
    await expect(checkSpotifyCooldown()).resolves.toBeUndefined();
  });
});
