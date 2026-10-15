/** Opt-in synthetic local PostgreSQL only. MUSICNERD_MATCH_TEST_PORT=55442 pnpm test spotifyMatch.integration */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
import { clearArtistLinkColumn } from "@/lib/artistLinks/clearArtistLinkColumn";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";
import { recordSpotifyCooldown } from "@/lib/spotify/recordSpotifyCooldown";
import { checkSpotifyCooldown } from "@/lib/spotify/checkSpotifyCooldown";
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
    expect(location.path).toBe("/private/tmp/mn-spotify-match-local/cluster");
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
    await client`create type source_status as enum ('pending','approved','rejected')`;
    await client`create type claim_status as enum ('pending','approved','rejected')`;
    for (const table of [
      schema.artists,
      schema.artistActivityEvents,
      schema.artistIdMappings,
      schema.artistVaultSources,
      schema.artistClaims,
      schema.artistResearchJobs,
    ]) {
      const config = getTableConfig(table);
      await client.unsafe(
        `create table "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}`).join(",")})`,
      );
    }
    await client`alter table artist_activity_events alter column id set default gen_random_uuid()`;
    await client`alter table artists add column added_by uuid`;
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
  it("does not recreate a manually removed Spotify slot, even when it was empty", async () => {
    const { job, state } = await fixture();
    await database.transaction(tx => clearArtistLinkColumn(tx, job.artistId, "spotify"));
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
      await clearArtistLinkColumn(tx, job.artistId, "spotify");
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
  it("does not let concurrent shorter Retry-After replies shorten the shared deadline", async () => {
    vi.stubEnv("SPOTIFY_WEB_CLIENT_ID", "local-shared-fixture");
    const start = Date.now();
    await Promise.all([
      recordSpotifyCooldown("3600"),
      recordSpotifyCooldown("60"),
      recordSpotifyCooldown("120"),
    ]);
    const [row] =
      await client`select extract(epoch from blocked_until)*1000 as until from provider_request_cooldowns`;
    expect(Number(row.until)).toBeGreaterThanOrEqual(start + 3600000);
    await expect(checkSpotifyCooldown()).rejects.toMatchObject({ status: 429, requested: false });
    await client`update provider_request_cooldowns set blocked_until=now()-interval '1 second'`;
    await expect(checkSpotifyCooldown()).resolves.toBeUndefined();
  });
});
