import { extendWebFixture } from "../../../docs/prototypes/pg17-ci/extendWebFixture";
import { PgTable } from "drizzle-orm/pg-core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { serveAboutRoutes } from "../../../docs/prototypes/pg17-ci/serveAboutRoutes";
import { createHostedAboutAdapter } from "../../../docs/prototypes/hosted-about/createHostedAboutAdapter";
import webArtistManifest from "../../../docs/prototypes/guarded-about/webArtistColumns.json";
import { buildFullArtistProjection } from "../../../docs/prototypes/guarded-about/buildFullArtistProjection";
import { useExistingUrlReceipts } from "../../../docs/prototypes/guarded-about/useExistingUrlReceipts";
import { createHash } from "node:crypto";
import migrationFixtures from "../../../docs/prototypes/pg17-ci/migration-fixtures.json";
import { readFileSync, realpathSync } from "node:fs";
import { userInfo } from "node:os";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, getTableColumns, getTableName, is, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";

function readMigration(file: string) {
  const fixture = migrationFixtures.find(item => item.file === file);
  if (!fixture) throw new Error("Unrecognized synthetic migration fixture");
  const contents = readFileSync(
    new URL(`../../../docs/prototypes/pg17-ci/${fixture.fixture}`, import.meta.url),
    "utf8",
  );
  if (createHash("sha256").update(contents).digest("hex") !== fixture.sha256)
    throw new Error("Synthetic migration fixture checksum mismatch");
  return contents;
}

// Opt-in only. Never consult application credentials or a network URL.
const socket = process.env.MN_1655_PG_SOCKET;
if (socket && !/^\/tmp\/mn-1655-pg\.[A-Za-z0-9]+$/.test(socket))
  throw new Error("Unsafe test socket");
const options = {
  host: socket,
  port: 55465,
  database: "mn_1655_synthetic",
  prepare: false,
  connect_timeout: 3,
  connection: { statement_timeout: 6000, application_name: "mn-1655-local-test" },
};
const admin = socket ? postgres({ ...options, user: userInfo().username, max: 2 }) : undefined;
const client = socket ? postgres({ ...options, user: "mnweb", max: 4 }) : undefined;
const competitor = socket ? postgres({ ...options, user: "mnweb", max: 1 }) : undefined;
const driver = client ? drizzle(client, { schema }) : undefined;
let holdCommit: (() => Promise<void>) | undefined;
let startBarrier: (() => Promise<void>) | undefined;
const backendPids = new Set<number>();
const databaseOverrides = {
  execute: (query: Parameters<NonNullable<typeof driver>["execute"]>[0]) => driver!.execute(query),
  transaction: (
    fn: (
      tx: Parameters<Parameters<NonNullable<typeof driver>["transaction"]>[0]>[0],
    ) => Promise<unknown>,
  ) =>
    driver!.transaction(async tx => {
      const [pid] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      backendPids.add(pid.pid);
      await startBarrier?.();
      const result = await fn(tx);
      if (holdCommit) {
        const hold = holdCommit;
        holdCommit = undefined;
        await hold();
      }
      return result;
    }),
};
const database = new Proxy(databaseOverrides, {
  get(target, key) {
    if (key in target) return Reflect.get(target, key);
    const value = Reflect.get(driver!, key);
    return typeof value === "function" ? value.bind(driver) : value;
  },
});
let routeAdapter: ReturnType<typeof createHostedAboutAdapter>;
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({
  verifyPrivyAccessToken: async (token: string) =>
    token === "local-synthetic" ? "local-subject" : null,
}));
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({
  synthesizeArtistDoc: (...args: Parameters<typeof routeAdapter.synthesizeArtistDoc>) =>
    routeAdapter.synthesizeArtistDoc(...args),
}));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({
  generateAboutFromDoc: (...args: Parameters<typeof routeAdapter.generateAboutFromDoc>) =>
    routeAdapter.generateAboutFromDoc(...args),
}));
vi.mock("@/lib/lore/generateLoreSummary", () => ({
  generateLoreSummary: (...args: Parameters<typeof routeAdapter.generateLoreSummary>) =>
    routeAdapter.generateLoreSummary(...args),
}));
const localBuilds = new Map<string, Promise<unknown>>();
const localBuildErrors: unknown[] = [];
vi.mock("workflow/api", () => ({
  start: async (run: (...args: never[]) => Promise<unknown>, args: never[]) => {
    const runId = `local-build-${localBuilds.size + 1}`;
    const task = new Promise(resolve => setTimeout(resolve, 100)).then(() => run(...args));
    localBuilds.set(
      runId,
      task.catch(error => {
        localBuildErrors.push(error);
      }),
    );
    return { runId };
  },
}));
vi.mock("workflow", () => ({
  FatalError: class extends Error {},
  createHook: () => ({ getConflict: async () => null, [Symbol.dispose]() {} }),
}));
vi.mock("@/lib/discovery/discoverArtistProfilesStream", () => ({
  discoverArtistProfilesStream: async function* () {
    yield { kind: "checked", displayName: "Synthetic catalog" };
  },
}));
vi.mock("@/lib/vault/runSourceSearch", () => ({
  runSourceSearch: async (artistId: string) => {
    const saved = await insertVaultSource({
      artistId,
      url: "https://example.org/synthetic-research",
      title: "Synthetic researched source",
      status: "pending",
      extractedText: "Synthetic verified research evidence. ".repeat(30),
    });
    return saved ? [saved] : [];
  },
}));
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { persistArtistBio } = await import("../persistArtistBio");
const { persistSetupLore } = await import("@/lib/onboarding/persistSetupLore");
const { LoreChangedError } = await import("@/lib/lore/LoreChangedError");
const { resetClaimBuild } = await import("@/lib/claimBuild/resetClaimBuild");
const { reserveAboutLoreRefresh } = await import("../reserveAboutLoreRefresh");
const { finishAboutLoreRefresh } = await import("../finishAboutLoreRefresh");
const { getPublicSavedBio } = await import("../getPublicSavedBio");
const { insertVaultSource } = await import("@/lib/vault/insertVaultSource");
const { updateVaultSourceStatus } = await import("@/lib/vault/updateVaultSourceStatus");

const { buildDocSources } = await import("@/lib/lore/buildDocSources");
const routes = await import("@/app/api/artistBio/[id]/route");
const stateRoutes = await import("@/app/api/onboarding/[artistId]/state/route");
const buildRoutes = await import("@/app/api/onboarding/[artistId]/build/route");
const claimReadRoutes = await import("@/app/api/user/has-claim/route");
const ugcRoutes = await import("@/app/api/ugcCount/route");
const platformRoutes = await import("@/app/api/platformRegexes/route");
const latestReadRoutes = await import("@/app/api/artist/[id]/latest-refresh/route");
const discoveryReadRoutes = await import("@/app/api/artist/[id]/research/discoveries/route");
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  sourceId = "00000000-0000-4000-8000-000000000003",
  event = "00000000-0000-4000-8000-000000000004",
  claim = "00000000-0000-4000-8000-000000000005";
const source = {
  id: sourceId,
  activityId: event,
  origin: "submission",
  publication: "inherit",
  url: "https://example.org/evidence",
  extractedText: "Verified synthetic evidence. ".repeat(30),
};
const sources = [
  {
    id: 1,
    kind: "vault" as const,
    label: "Evidence",
    url: source.url,
    revision: vaultSourceRevision(source),
  },
];
const auth = { userId: user, expectedClaimId: null };
const publication = {
  ownership: auth,
  generated: true,
  expectedBio: "Original",
  documentOrigin: "server" as const,
  document: { content: "Synthetic Lore", sources },
};
const tables = {
  artists: schema.artists,
  users: schema.users,
  artist_claims: schema.artistClaims,
  artist_bio_versions: schema.artistBioVersions,
  artist_docs: schema.artistDocs,
  artist_onboarding_steps: schema.artistOnboardingSteps,
  artist_vault_sources: schema.artistVaultSources,
  artist_activity_events: schema.artistActivityEvents,
  artist_research_jobs: schema.artistResearchJobs,
};
if (process.env.MN_1655_FULL_NEXT === "yes") {
  for (const table of Object.values(schema)) {
    if (is(table, PgTable) && !getTableName(table).includes("provenance"))
      Object.assign(tables, { [getTableName(table)]: table });
  }
}
const fixtureTables = new Set(Object.keys(tables));
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}
function capture<T>(promise: Promise<T>) {
  return promise.then(
    value => ({ value, error: undefined }),
    error => ({ value: undefined, error }),
  );
}
function errorCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: unknown };
  return e?.code ?? (e?.cause ? errorCode(e.cause) : undefined);
}
async function waitForBlockedWriter() {
  for (let i = 0; i < 100; i++) {
    const rows =
      await admin!`select pid from pg_stat_activity where datname='mn_1655_synthetic' and application_name='mn-1655-local-test' and wait_event_type='Lock'`;
    if (rows.length) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error("Competing database write did not reach its lock");
}
async function heldPublication() {
  const entered = deferred(),
    release = deferred();
  holdCommit = async () => {
    entered.resolve();
    await release.promise;
  };
  const outcome = capture(persistArtistBio(artist, "Generated", publication));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      entered.promise,
      outcome.then(result => {
        throw result.error ?? new Error("Publication completed without the barrier");
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Publication barrier timed out")), 2000);
      }),
    ]);
  } catch (error) {
    release.resolve();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return { outcome, release: release.resolve };
}

describe.skipIf(!socket)(
  "isolated native PostgreSQL migration and concurrent About publication",
  () => {
    beforeAll(async () => {
      const [identity] =
        await admin!`select current_database() as db, current_setting('data_directory') as dir, current_setting('listen_addresses') as addresses, shobj_description(oid,'pg_database') as marker from pg_database where datname=current_database()`;
      if (
        identity.db !== "mn_1655_synthetic" ||
        identity.marker !== "mn-1655-synthetic-only" ||
        identity.addresses !== "" ||
        realpathSync(identity.dir) !== realpathSync(`${socket}/data`)
      )
        throw new Error("Refusing non-disposable database");
      await admin!.unsafe(
        "drop schema if exists mn_private cascade;drop schema public cascade;create schema public;revoke create on schema public from public;grant usage on schema public to mnweb",
      );
      for (const [name, table] of Object.entries(tables)) {
        const columns = Object.values(getTableColumns(table))
          .filter(c => c.name !== "bio_provenance" && c.name !== "publication")
          .map(c => {
            const rawType = c.getSQLType();
            const type =
              "enumValues" in c && Array.isArray(c.enumValues)
                ? "text"
                : rawType === "platform_type[]"
                  ? "text[]"
                  : rawType;
            const defaultValue =
              c.name === "id"
                ? c.getSQLType() === "uuid"
                  ? " primary key default gen_random_uuid()"
                  : " primary key"
                : c.name === "created_at" || c.name === "updated_at" || c.name === "confirmed_at"
                  ? " default now()"
                  : c.name === "attempts"
                    ? " default 0"
                    : name === "artist_research_jobs" && c.name === "status"
                      ? " default 'pending'"
                      : "";
            return `"${c.name}" ${type}${defaultValue}`;
          })
          .join(",");
        await admin!.unsafe(
          `create table ${name}(${columns});alter table ${name} enable row level security;create policy synthetic_mnweb on ${name} to mnweb using(true) with check(true);grant select,insert,update,delete on ${name} to mnweb`,
        );
      }
      await admin!.unsafe(
        "alter table artist_docs add unique(artist_id);alter table artist_onboarding_steps add unique(artist_id,step);alter table artist_vault_sources add unique(artist_id,url);create unique index active_research_job on artist_research_jobs(artist_id,kind) where status in ('pending','running')",
      );
      await admin!`insert into artists(id,bio) values(${artist},'Legacy biography')`;
      await admin!`insert into artist_bio_versions(artist_id,bio_text,is_pinned) values(${artist},'Legacy pinned biography',true)`;
      await admin!.unsafe(`do $$ begin
        if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
        if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
      end $$`);
      for (const file of [
        "0060_source_publication.sql",
        "0061_about_evidence_provenance.sql",
        "0062_public_url_receipts.sql",
        "0063_legacy_bio_publications.sql",
        "0064_lore_activity_lock.sql",
      ])
        await admin!.unsafe(readMigration(file));
      await admin!.unsafe("revoke update,delete on artist_activity_events from mnweb");
      if (process.env.MN_1655_FULL_NEXT === "yes") await extendWebFixture(admin!, fixtureTables);
      expect(
        await client!`select a.bio,p.provenance as bio_provenance from artists a left join mn_private.artist_bio_provenance p on p.artist_id=a.id`,
      ).toEqual([{ bio: "Legacy biography", bio_provenance: null }]);
      expect(
        await client!`select v.bio_text,v.is_pinned,p.provenance as bio_provenance from artist_bio_versions v left join mn_private.artist_bio_version_provenance p on p.version_id=v.id`,
      ).toEqual([{ bio_text: "Legacy pinned biography", is_pinned: true, bio_provenance: null }]);
      const [role] =
        await client!`select rolsuper,rolbypassrls from pg_roles where rolname=current_user`;
      expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
      await expect(
        client!.unsafe("alter table artists add column unauthorized text"),
      ).rejects.toMatchObject({ code: "42501" });
    }, 30000);
    beforeEach(async () => {
      holdCommit = undefined;
      startBarrier = undefined;
      backendPids.clear();
      await admin!.unsafe(
        `truncate mn_private.legacy_bio_publications,mn_private.public_url_receipts,mn_private.artist_bio_provenance,mn_private.artist_bio_version_provenance,${[...fixtureTables].join(",")}`,
      );
      await admin!`insert into artists(id,name,bio) values(${artist},'Synthetic artist','Original')`;
      await admin!`insert into users(id,is_admin,is_white_listed) values(${user},true,true)`;
      await admin!`insert into artist_vault_sources(id,artist_id,activity_id,origin,status,publication,url,extracted_text) values(${sourceId},${artist},${event},'submission','approved','inherit',${source.url},${source.extractedText})`;
      await admin!`insert into artist_activity_events(id,artist_id,source_id,actor_kind,actor_user_id,trigger,action) values(${event},${artist},${sourceId},'user',${user},'trusted_submission','source_submission')`;
    });
    afterAll(async () => {
      holdCommit = undefined;
      startBarrier = undefined;
      await Promise.all([
        client?.end({ timeout: 1 }),
        competitor?.end({ timeout: 1 }),
        admin?.end({ timeout: 1 }),
      ]);
    });
    // Historical SQL contract from API main 0f315b5a persistArtistBio/saveBioVersions.
    // This tests DB compatibility and the real new reader, not an entire old deployed binary.
    async function legacyWrite(text: string) {
      await client!.begin(async tx => {
        await tx`select id from artists where id=${artist} for update`;
        await tx`insert into artist_bio_versions(artist_id,bio_text,is_pinned) values(${artist},${text},false)`;
        await tx`update artists set bio=${text} where id=${artist}`;
      });
    }
    async function allowLegacy() {
      await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
      await admin!`insert into mn_private.legacy_bio_publications values(${artist},${claim},encode(sha256(convert_to('Original','UTF8')),'hex'))`;
    }
    it("mixed-version: changed legacy write succeeds but consumes allowance and hides new public read", async () => {
      await allowLegacy();
      expect(await getPublicSavedBio(artist)).toBe("Original");
      await legacyWrite("Legacy writer changed text");
      expect(await getPublicSavedBio(artist)).toBeNull();
      expect(await client!`select bio from artists where id=${artist}`).toEqual([
        { bio: "Legacy writer changed text" },
      ]);
      expect(await client!`select bio_text from artist_bio_versions`).toEqual([
        { bio_text: "Legacy writer changed text" },
      ]);
      expect(await client!`select * from mn_private.legacy_bio_publications`).toHaveLength(0);
    });
    it("mixed-version: an unchanged legacy write preserves the exact allowance", async () => {
      await allowLegacy();
      await legacyWrite("Original");
      expect(await getPublicSavedBio(artist)).toBe("Original");
      expect(await client!`select * from mn_private.legacy_bio_publications`).toHaveLength(1);
    });
    it("mixed-version: old overwrite invalidates new evidence hash without deleting stored evidence", async () => {
      await persistArtistBio(artist, "New evidenced About", publication);
      expect(await getPublicSavedBio(artist)).toBe("New evidenced About");
      const before = await client!`select provenance from mn_private.artist_bio_provenance`;
      await legacyWrite("Late old result");
      expect(await getPublicSavedBio(artist)).toBeNull();
      expect(await client!`select provenance from mn_private.artist_bio_provenance`).toEqual(
        before,
      );
    });
    it("mixed-version: source withdrawal hides new reader while historical claimed raw-read contract still sees bytes", async () => {
      await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
      await persistArtistBio(artist, "New evidenced About", {
        ...publication,
        ownership: { userId: user, expectedClaimId: claim },
      });
      await client!`update artist_vault_sources set publication='private' where id=${sourceId}`;
      expect(await getPublicSavedBio(artist)).toBeNull();
      expect(
        await client!`select a.bio from artists a where a.id=${artist} and exists(select 1 from artist_claims c where c.artist_id=a.id and c.status='approved')`,
      ).toEqual([{ bio: "New evidenced About" }]);
    });
    it("mixed-version: additive source migration accepts old insert columns without inventing trust", async () => {
      await client!`insert into artist_vault_sources(id,artist_id,origin,status,url,extracted_text) values('00000000-0000-4000-8000-000000000077',${artist},'submission','approved','https://example.org/legacy','Legacy extracted text')`;
      expect(
        await client!`select publication,activity_id from artist_vault_sources where id='00000000-0000-4000-8000-000000000077'`,
      ).toEqual([{ publication: "inherit", activity_id: null }]);
    });
    it("mixed-version: snapshot lock delays an old write but cannot fence its later commit", async () => {
      await allowLegacy();
      const locked = deferred(),
        release = deferred();
      const blocker = competitor!.begin(async tx => {
        await tx`lock table artists,artist_claims,artist_bio_versions,artist_vault_sources in share row exclusive mode`;
        locked.resolve();
        await release.promise;
      });
      await locked.promise;
      const writing = legacyWrite("Late old result after cutover");
      try {
        await waitForBlockedWriter();
      } finally {
        release.resolve();
      }
      await blocker;
      await writing;
      expect(await getPublicSavedBio(artist)).toBeNull();
      expect(await client!`select bio from artists where id=${artist}`).toEqual([
        { bio: "Late old result after cutover" },
      ]);
    });
    it("writer fence: rejects a late legacy transaction and preserves history and exact allowance", async () => {
      await allowLegacy();
      await admin!.unsafe(readMigration("0065_about_writer_fence.sql"));
      try {
        await expect(legacyWrite("Late old result")).rejects.toMatchObject({ code: "55000" });
        expect(await getPublicSavedBio(artist)).toBe("Original");
        expect(await client!`select * from artist_bio_versions`).toHaveLength(0);
        expect(await client!`select * from mn_private.legacy_bio_publications`).toHaveLength(1);
        await legacyWrite("Original");
        expect(await getPublicSavedBio(artist)).toBe("Original");
      } finally {
        await admin!.unsafe(
          "drop trigger if exists require_about_writer_version on artists; drop function if exists mn_private.require_about_writer_version()",
        );
      }
    });
    it("writer fence: transaction-local opt-in permits current writes without leaking to pooled old writes", async () => {
      await admin!.unsafe(readMigration("0065_about_writer_fence.sql"));
      try {
        await competitor!.begin(async tx => {
          await tx`select set_config('musicnerd.about_writer_version','1655-v1',true)`;
          await tx`update artists set bio='Current writer' where id=${artist}`;
        });
        await expect(
          competitor!`update artists set bio='Old pooled writer' where id=${artist}`,
        ).rejects.toMatchObject({ code: "55000" });
        await expect(
          competitor!.begin(async tx => {
            await tx`select set_config('musicnerd.about_writer_version','1655-v1',true)`;
            await tx`update artists set bio='Rolled back' where id=${artist}`;
            throw new Error("rollback fixture");
          }),
        ).rejects.toThrow("rollback fixture");
        await expect(
          competitor!`update artists set bio=null where id=${artist}`,
        ).rejects.toMatchObject({ code: "55000" });
        expect(await client!`select bio from artists where id=${artist}`).toEqual([
          { bio: "Current writer" },
        ]);
      } finally {
        await admin!.unsafe(
          "drop trigger if exists require_about_writer_version on artists; drop function if exists mn_private.require_about_writer_version()",
        );
      }
    });
    it("writer fence: real API publication and reset retain authority and work with the fence enabled", async () => {
      await admin!.unsafe(readMigration("0065_about_writer_fence.sql"));
      try {
        await persistArtistBio(artist, "Fenced evidenced About", publication);
        expect(await getPublicSavedBio(artist)).toBe("Fenced evidenced About");
        await expect(
          persistArtistBio(artist, "Unauthorized", { ownership: { expectedClaimId: claim } }),
        ).rejects.toThrow();
        expect(await getPublicSavedBio(artist)).toBe("Fenced evidenced About");
        const backup = await resetClaimBuild(artist);
        expect(backup?.bio).toBe("Fenced evidenced About");
        expect(await client!`select bio from artists where id=${artist}`).toEqual([{ bio: null }]);
        await expect(legacyWrite("Delayed old workflow")).rejects.toMatchObject({ code: "55000" });
      } finally {
        await admin!.unsafe(
          "drop trigger if exists require_about_writer_version on artists; drop function if exists mn_private.require_about_writer_version()",
        );
      }
    });
    it("writer fence: an old transaction started before activation is rejected and migration rollback is atomic", async () => {
      const begun = deferred(),
        release = deferred();
      const old = capture(
        competitor!.begin(async tx => {
          await tx`select id from artists where id=${artist} for update`;
          begun.resolve();
          await release.promise;
          await tx`insert into artist_bio_versions(artist_id,bio_text,is_pinned) values(${artist},'Late history',false)`;
          await tx`update artists set bio='Late old result' where id=${artist}`;
        }),
      );
      await begun.promise;
      const ddl = readMigration("0065_about_writer_fence.sql");
      try {
        await admin!.unsafe(ddl);
      } finally {
        release.resolve();
      }
      try {
        expect((await old).error).toMatchObject({ code: "55000" });
        expect(await client!`select * from artist_bio_versions`).toHaveLength(0);
        expect(await client!`select bio from artists where id=${artist}`).toEqual([
          { bio: "Original" },
        ]);
      } finally {
        await admin!.unsafe(
          "drop trigger if exists require_about_writer_version on artists; drop function if exists mn_private.require_about_writer_version()",
        );
      }
      await expect(
        admin!.begin(async tx => {
          await tx.unsafe(ddl);
          throw new Error("abort migration");
        }),
      ).rejects.toThrow("abort migration");
      await legacyWrite("After aborted migration");
      expect(await client!`select bio from artists where id=${artist}`).toEqual([
        { bio: "After aborted migration" },
      ]);
    });
    it("writer fence: activation fails atomically while an old writer already holds a table write lock", async () => {
      const locked = deferred(),
        release = deferred();
      const old = competitor!.begin(async tx => {
        await tx`update artists set bio=bio where id=${artist}`;
        locked.resolve();
        await release.promise;
        await tx`update artists set bio='Committed before activation' where id=${artist}`;
      });
      await locked.promise;
      const ddl = readMigration("0065_about_writer_fence.sql");
      try {
        await expect(
          admin!.begin(async tx => {
            await tx`set local lock_timeout='100ms'`;
            await tx.unsafe(ddl);
          }),
        ).rejects.toMatchObject({ code: "55P03" });
      } finally {
        release.resolve();
        await old;
      }
      expect(
        await admin!`select to_regprocedure('mn_private.require_about_writer_version()') as function`,
      ).toEqual([{ function: null }]);
      expect(await client!`select bio from artists where id=${artist}`).toEqual([
        { bio: "Committed before activation" },
      ]);
      await admin!.unsafe(ddl);
      try {
        await expect(legacyWrite("After activation")).rejects.toMatchObject({ code: "55000" });
      } finally {
        await admin!.unsafe(
          "drop trigger require_about_writer_version on artists; drop function mn_private.require_about_writer_version()",
        );
      }
    });
    it("validates actual Lore evidence with restricted event privileges", async () => {
      await admin!.unsafe("revoke update,delete on artist_activity_events from mnweb");
      try {
        const { assertLoreSourcesCurrent } = await import("@/lib/lore/assertLoreSourcesCurrent");
        await expect(
          driver!.transaction(tx => assertLoreSourcesCurrent(tx, artist, sources)),
        ).resolves.toBeUndefined();
      } finally {
        await expect(
          client!`update artist_activity_events set actor_user_id=null`,
        ).rejects.toMatchObject({ code: "42501" });
      }
    });
    it("locks the newly linked event and rejects its later trust withdrawal", async () => {
      const nextEvent = "00000000-0000-4000-8000-000000000099";
      await admin!`insert into artist_activity_events(id,artist_id,source_id,actor_kind,actor_user_id,trigger,action) values(${nextEvent},${artist},${sourceId},'user',${user},'trusted_submission','source_submission')`;
      await admin!`update artist_vault_sources set activity_id=${nextEvent} where id=${sourceId}`;
      const current = sources.map(item => ({
        ...item,
        revision: vaultSourceRevision({ ...source, activityId: nextEvent }),
      }));
      const { assertLoreSourcesCurrent } = await import("@/lib/lore/assertLoreSourcesCurrent");
      await driver!.transaction(async tx => {
        await assertLoreSourcesCurrent(tx, artist, current);
        await expect(
          admin!.begin(async other => {
            await other`set local lock_timeout='100ms'`;
            await other`update artist_activity_events set actor_user_id=null where id=${nextEvent}`;
          }),
        ).rejects.toMatchObject({ code: "55P03" });
      });
      await admin!`update artist_activity_events set actor_user_id=null where id=${nextEvent}`;
      await expect(
        driver!.transaction(tx => assertLoreSourcesCurrent(tx, artist, current)),
      ).rejects.toThrow("Lore sources changed");
    });
    it("reserves one lease across two real simultaneous backend sessions", async () => {
      const both = deferred();
      let count = 0;
      startBarrier = async () => {
        if (++count === 2) both.resolve();
        await both.promise;
      };
      const outcomes = await Promise.all([
        reserveAboutLoreRefresh(artist, auth),
        reserveAboutLoreRefresh(artist, auth),
      ]);
      startBarrier = undefined;
      expect(backendPids.size).toBe(2);
      expect(outcomes.map(o => o.status).sort()).toEqual(["acquired", "busy"]);
      expect(
        await client!`select count(*)::int as n from artist_research_jobs where status='running'`,
      ).toEqual([{ n: 1 }]);
    });
    it.each(["private", "rejected", "event", "admin"])(
      "holds %s changes until About commits, then rechecks public visibility",
      async change => {
        const held = await heldPublication();
        let outcome;
        try {
          outcome = capture(
            (change === "event" ? admin! : competitor!).begin(async tx => {
              await tx`set local lock_timeout='250ms'`;
              if (change === "private")
                await tx`update artist_vault_sources set publication='private' where id=${sourceId}`;
              if (change === "rejected")
                await tx`update artist_vault_sources set status='rejected' where id=${sourceId}`;
              if (change === "event")
                await tx`update artist_activity_events set actor_user_id=null where id=${event}`;
              if (change === "admin")
                await tx`update users set is_admin=false,is_white_listed=false where id=${user}`;
            }),
          );
          await waitForBlockedWriter();
          expect(errorCode((await outcome).error)).toBe("55P03");
        } finally {
          held.release();
          await held.outcome;
        }
        expect((await held.outcome).error).toBeUndefined();
        if (change === "private")
          await competitor!`update artist_vault_sources set publication='private' where id=${sourceId}`;
        if (change === "rejected")
          await competitor!`update artist_vault_sources set status='rejected' where id=${sourceId}`;
        if (change === "event")
          await admin!`update artist_activity_events set actor_user_id=null where id=${event}`;
        if (change === "admin")
          await competitor!`update users set is_admin=false,is_white_listed=false where id=${user}`;
        expect(await getPublicSavedBio(artist)).toBe(change === "admin" ? "Generated" : null);
        if (change === "admin")
          await expect(reserveAboutLoreRefresh(artist, auth)).rejects.toThrow("ownership changed");
        expect(await client!`select bio from artists`).toEqual([{ bio: "Generated" }]);
        expect(await client!`select count(*)::int as n from artist_bio_versions`).toEqual([
          { n: 2 },
        ]);
      },
    );
    it.each(["private", "rejected"])(
      "rejects %s evidence committed before publication with no partial write",
      async change => {
        if (change === "private")
          await competitor!`update artist_vault_sources set publication='private' where id=${sourceId}`;
        else
          await competitor!`update artist_vault_sources set status='rejected' where id=${sourceId}`;
        await expect(persistArtistBio(artist, "Generated", publication)).rejects.toThrow(
          "Lore sources changed",
        );
        expect(await client!`select bio from artists`).toEqual([{ bio: "Original" }]);
        expect(await client!`select count(*)::int as n from artist_docs`).toEqual([{ n: 0 }]);
        expect(await client!`select count(*)::int as n from artist_bio_versions`).toEqual([
          { n: 0 },
        ]);
      },
    );
    it("serializes claim revocation ahead of a delayed publication", async () => {
      await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
      const entered = deferred(),
        release = deferred();
      const revoke = capture(
        competitor!.begin(async tx => {
          await tx`select id from artists where id=${artist} for update`;
          await tx`update artist_claims set status='rejected' where id=${claim}`;
          entered.resolve();
          await release.promise;
        }),
      );
      await entered.promise;
      const publish = capture(
        persistArtistBio(artist, "Generated", {
          ...publication,
          ownership: { userId: user, expectedClaimId: claim },
        }),
      );
      try {
        await waitForBlockedWriter();
      } finally {
        release.resolve();
        await revoke;
      }
      expect((await publish).error?.message).toContain("ownership changed");
      expect(await client!`select bio from artists`).toEqual([{ bio: "Original" }]);
    });
    it.each(["insert", "approve"])(
      "serializes an eligible source %s through the actual writer's artist lock",
      async mode => {
        const pending = "00000000-0000-4000-8000-000000000009";
        if (mode === "approve")
          await admin!`insert into artist_vault_sources(id,artist_id,origin,status,publication,url,extracted_text) values(${pending},${artist},'submission','pending','public','https://example.org/second',${source.extractedText})`;
        const held = await heldPublication();
        const added = capture(
          mode === "insert"
            ? insertVaultSource(
                {
                  artistId: artist,
                  url: "https://example.org/second",
                  extractedText: source.extractedText,
                },
                { userId: user, trigger: "trusted_submission", approveIfTrusted: true },
              )
            : updateVaultSourceStatus(pending, "approved"),
        );
        try {
          await waitForBlockedWriter();
        } finally {
          held.release();
          await held.outcome;
        }
        expect((await added).error).toBeUndefined();
        expect(await getPublicSavedBio(artist)).toBe("Generated");
        expect(await reserveAboutLoreRefresh(artist, auth)).toMatchObject({
          status: "acquired",
          needsRefresh: true,
        });
      },
    );
    it("rejects publication when a new eligible source committed first", async () => {
      await insertVaultSource(
        {
          artistId: artist,
          url: "https://example.org/second",
          extractedText: source.extractedText,
        },
        { userId: user, trigger: "trusted_submission", approveIfTrusted: true },
      );
      await expect(persistArtistBio(artist, "Generated", publication)).rejects.toThrow(
        "Lore sources changed",
      );
      expect(await client!`select bio from artists`).toEqual([{ bio: "Original" }]);
    });
    it("allows only one competing expected-bio write without a lost update", async () => {
      const results = await Promise.all([
        capture(persistArtistBio(artist, "First", publication)),
        capture(persistArtistBio(artist, "Second", publication)),
      ]);
      expect(results.filter(r => !r.error)).toHaveLength(1);
      expect(results.find(r => r.error)?.error).toBeInstanceOf(BioConflictError);
      expect(await client!`select count(*)::int as n from artist_bio_versions`).toEqual([{ n: 2 }]);
    });
    it("cannot settle a replacement lease with the original token", async () => {
      const lease = await reserveAboutLoreRefresh(artist, auth);
      if (lease.status !== "acquired") throw new Error("No lease");
      await competitor!`update artist_research_jobs set claimed_at=claimed_at+interval '1 second' where id=${lease.jobId}`;
      expect(await finishAboutLoreRefresh(artist, lease, "rebuilt")).toBe(false);
      expect(await client!`select status from artist_research_jobs`).toEqual([
        { status: "running" },
      ]);
    });
    it("times out at the actual two-second artist lock budget without creating a lease", async () => {
      const entered = deferred(),
        release = deferred();
      const holder = capture(
        competitor!.begin(async tx => {
          await tx`select id from artists where id=${artist} for update`;
          entered.resolve();
          await release.promise;
        }),
      );
      await entered.promise;
      const started = Date.now();
      try {
        const result = await capture(reserveAboutLoreRefresh(artist, auth));
        expect(errorCode(result.error)).toBe("55P03");
        expect(Date.now() - started).toBeGreaterThanOrEqual(1800);
        expect(Date.now() - started).toBeLessThan(4500);
      } finally {
        release.resolve();
        await holder;
      }
      expect(await client!`select count(*)::int as n from artist_research_jobs`).toEqual([
        { n: 0 },
      ]);
    });

    it("serializes reset behind generation and backs up matching committed text and lineage", async () => {
      const held = await heldPublication();
      const reset = capture(resetClaimBuild(artist));
      try {
        await waitForBlockedWriter();
      } finally {
        held.release();
      }
      expect((await held.outcome).error).toBeUndefined();
      const result = await reset;
      expect(result.error).toBeUndefined();
      expect(result.value?.bio).toBe("Generated");
      expect(result.value?.bioProvenance).toMatchObject({ kind: "generated", sources });
      expect(await client!`select bio from artists`).toEqual([{ bio: null }]);
      expect(await client!`select * from mn_private.artist_bio_provenance`).toHaveLength(0);
      expect(await client!`select * from mn_private.artist_bio_version_provenance`).toHaveLength(1);
    });

    it("denies direct public provenance reads while old public artist reads retain their shape", async () => {
      await admin!.unsafe(`do $$ begin
        if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
        if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
      end $$;
      grant usage on schema public to anon,authenticated;
      grant select on artists to anon,authenticated;
      create policy synthetic_public_read on artists for select to public using(true)`);
      await persistArtistBio(artist, "Generated", publication);
      for (const role of ["anon", "authenticated"]) {
        const rows = await admin!.begin(async tx => {
          await tx.unsafe(`set local role ${role}`);
          return tx`select * from artists`;
        });
        expect(rows[0].bio).toBe("Generated");
        expect(rows[0]).not.toHaveProperty("bio_provenance");
        for (const table of [
          "artist_bio_provenance",
          "artist_bio_version_provenance",
          "public_url_receipts",
        ]) {
          const result = await capture(
            admin!.begin(async tx => {
              await tx.unsafe(`set local role ${role}`);
              return tx.unsafe(`select * from mn_private.${table}`);
            }),
          );
          expect(errorCode(result.error)).toBe("42501");
        }
      }
      expect(
        await client!`select count(*)::int as n from mn_private.artist_bio_provenance`,
      ).toEqual([{ n: 1 }]);
    });

    it("serializes shared URL receipts across independent artist publications without duplicate receipts", async () => {
      const otherArtist = "00000000-0000-4000-8000-000000000011";
      const otherSource = {
        ...source,
        id: "00000000-0000-4000-8000-000000000012",
        activityId: null,
        publication: "public",
      };
      await admin!`insert into artists(id,name,bio) values(${otherArtist},'Other synthetic artist','Original')`;
      await admin!`insert into artist_vault_sources(id,artist_id,origin,status,publication,url,extracted_text) values(${otherSource.id},${otherArtist},'submission','approved','public',${source.url},${source.extractedText})`;
      const held = await heldPublication();
      const other = capture(
        persistArtistBio(otherArtist, "Other generated", {
          ...publication,
          document: {
            content: "Other Lore",
            sources: [{ ...sources[0], revision: vaultSourceRevision(otherSource) }],
          },
        }),
      );
      try {
        await waitForBlockedWriter();
      } finally {
        held.release();
        await Promise.all([held.outcome, other]);
      }
      expect((await held.outcome).error).toBeUndefined();
      expect((await other).error).toBeUndefined();
      expect(await client!`select url from mn_private.public_url_receipts`).toEqual([
        { url: source.url },
      ]);
      expect(
        await client!`select count(*)::int as n from mn_private.artist_bio_provenance`,
      ).toEqual([{ n: 2 }]);
    });

    it("prepares idempotent receipts with mnweb INSERT/SELECT only and rolls back receipt conflicts", async () => {
      await persistArtistBio(artist, "Generated", publication);
      await persistArtistBio(artist, "Generated", { ...publication, expectedBio: "Generated" });
      expect(await client!`select url,policy_version from mn_private.public_url_receipts`).toEqual([
        { url: source.url, policy_version: 1 },
      ]);
      for (const statement of [
        "update mn_private.public_url_receipts set policy_version=2",
        "delete from mn_private.public_url_receipts",
      ]) {
        const denied = await capture(client!.unsafe(statement));
        expect(errorCode(denied.error)).toBe("42501");
      }
      await admin!`update mn_private.public_url_receipts set url='https://example.org/conflict'`;
      const history = await client!`select * from artist_bio_versions order by id`;
      const attempt = await capture(
        persistArtistBio(artist, "Must roll back", { ...publication, expectedBio: "Generated" }),
      );
      expect(attempt.error).toBeInstanceOf(Error);
      expect((attempt.error as Error).message).toContain("URL receipt conflict");
      expect(await client!`select bio from artists`).toEqual([{ bio: "Generated" }]);
      expect(await client!`select * from artist_bio_versions order by id`).toEqual(history);
    });

    it.skipIf(process.env.MN_1655_FULL_NEXT !== "yes")(
      "runs the full Next profile and setup through real API stages",
      async () => {
        const artifact = process.env.MN_1655_NEXT_ARTIFACT;
        if (!artifact || !/^\/tmp\/mn-1655-next-[A-Za-z0-9]+$/.test(artifact))
          throw new Error("Explicit isolated Next artifact required");
        await admin!`update users set privy_user_id='local-subject',is_admin=false where id=${user}`;
        await admin!`update artists set bio=null where id=${artist}`;
        await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
        await admin!`insert into artist_vault_sources(id,artist_id,origin,status,publication,url,extracted_text) values('00000000-0000-4000-8000-000000000006',${artist},'submission','pending','inherit','https://example.org/pending-contribution','Pending synthetic contribution must remain pending')`;
        const originalTrustedSource =
          await client!`select * from artist_vault_sources where id=${sourceId}`;
        routeAdapter = createHostedAboutAdapter({}, buildDocSources);
        localBuildErrors.length = 0;
        localBuilds.clear();
        const context = () => ({ params: Promise.resolve({ artistId: artist }) });
        const statePath = `/api/onboarding/${artist}/state`;
        const buildPath = `/api/onboarding/${artist}/build`;
        const close = await serveAboutRoutes(routes, artist, {
          [`GET ${statePath}`]: request => stateRoutes.GET(request, context()),
          [`OPTIONS ${statePath}`]: () => stateRoutes.OPTIONS(),
          [`POST ${buildPath}`]: request => buildRoutes.POST(request, context()),
          [`OPTIONS ${buildPath}`]: () => buildRoutes.OPTIONS(),
          [`GET /api/artist/${artist}/latest-refresh`]: request =>
            latestReadRoutes.GET(request, { params: Promise.resolve({ id: artist }) }),
          [`OPTIONS /api/artist/${artist}/latest-refresh`]: () => latestReadRoutes.OPTIONS(),
          [`GET /api/artist/${artist}/research/discoveries?limit=10`]: request =>
            discoveryReadRoutes.GET(request, { params: Promise.resolve({ id: artist }) }),
          [`OPTIONS /api/artist/${artist}/research/discoveries?limit=10`]: async () =>
            discoveryReadRoutes.OPTIONS(),
          "GET /api/user/has-claim": request => claimReadRoutes.GET(request),
          "OPTIONS /api/user/has-claim": () => claimReadRoutes.OPTIONS(),
          "GET /api/ugcCount": request => ugcRoutes.GET(request),
          "OPTIONS /api/ugcCount": () => ugcRoutes.OPTIONS(),
          "GET /api/platformRegexes": () => platformRoutes.GET(),
          "OPTIONS /api/platformRegexes": () => platformRoutes.OPTIONS(),
        });
        const runProfile = async (mode = "") => {
          const result = await promisify(execFile)(
            process.execPath,
            ["docs/testing/local-1655-next/run.mjs", artifact, mode],
            {
              cwd: "/tmp/mn-1655-web-review-20261105",
              timeout: 180000,
              env: {
                NODE_ENV: "test",
                PATH: "/usr/bin:/bin",
                HOME: userInfo().homedir,
                TMPDIR: "/tmp",
                MN_1655_PG_SOCKET: socket!,
              },
              maxBuffer: 1024 * 1024,
            },
          );
          console.log(result.stdout.trim());
        };
        try {
          await runProfile();
          await Promise.all(localBuilds.values());
          const beforePreserve = await client!`select bio from artists where id=${artist}`;
          expect(beforePreserve).toEqual([{ bio: "Local claimant-authored About" }]);
          const priorHistory = await client!`select * from artist_bio_versions order by id`;
          expect(priorHistory.some(version => version.is_pinned === true)).toBe(true);
          const priorLore =
            await client!`select content,sources from artist_docs where artist_id=${artist}`;
          const priorCounters = routeAdapter.counters();
          await admin!`delete from artist_onboarding_steps where artist_id=${artist}`;
          await runProfile("preserve");
          await Promise.all(localBuilds.values());
          expect(await client!`select bio from artists where id=${artist}`).toEqual(beforePreserve);
          expect(await client!`select * from artist_bio_versions order by id`).toEqual(
            priorHistory,
          );
          expect(
            await client!`select content,sources from artist_docs where artist_id=${artist}`,
          ).toEqual(priorLore);
          expect(routeAdapter.counters()).toEqual(priorCounters);
          expect(
            await client!`select status,extracted_text from artist_vault_sources where id='00000000-0000-4000-8000-000000000006'`,
          ).toEqual([
            {
              status: "pending",
              extracted_text: "Pending synthetic contribution must remain pending",
            },
          ]);
          expect(localBuildErrors).toEqual([]);
          expect(
            await client!`select count(*)::int as n from artist_onboarding_steps where artist_id=${artist}`,
          ).toEqual([{ n: 4 }]);
          expect(await client!`select * from artist_vault_sources where id=${sourceId}`).toEqual(
            originalTrustedSource,
          );
          expect(
            await client!`select count(*)::int as n from artist_docs where artist_id=${artist}`,
          ).toEqual([{ n: 1 }]);
        } finally {
          await Promise.all(localBuilds.values());
          await close();
        }
      },
      240000,
    );

    it.skipIf(process.env.MN_1655_BROWSER !== "yes")(
      "drives the Web About component through HTTP into durable PostgreSQL",
      async () => {
        await admin!`update users set privy_user_id='local-subject',is_admin=false where id=${user}`;
        await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
        const close = await serveAboutRoutes(routes, artist);
        const browser = async (mode: string, expected: string, initialBio = "Synthetic About") => {
          const result = await promisify(execFile)(
            process.execPath,
            ["docs/testing/local-1655-browser/run.mjs", mode, expected, initialBio],
            {
              cwd: "/tmp/mn-1655-web-review-20261105",
              timeout: 45000,
              env: {
                NODE_ENV: "test",
                PATH: "/usr/bin:/bin",
                HOME: userInfo().homedir,
                TMPDIR: "/tmp",
              },
              maxBuffer: 1024 * 1024,
            },
          );
          console.log(result.stdout.trim());
        };
        try {
          routeAdapter = createHostedAboutAdapter({}, buildDocSources);
          await browser("success", "Synthetic About", "Original");
          expect(routeAdapter.counters()).toEqual({ lore: 1, about: 1, summary: 1 });
          await browser("success", "Synthetic About");
          expect(routeAdapter.counters()).toEqual({ lore: 1, about: 2, summary: 1 });
          const historyBeforeFailure = await client!`select * from artist_bio_versions order by id`;
          routeAdapter = createHostedAboutAdapter({ about: "fail" }, buildDocSources);
          await browser("failure", "Could not generate About from Lore");
          expect(await client!`select bio from artists where id=${artist}`).toEqual([
            { bio: "Synthetic About" },
          ]);
          await admin!`delete from artist_docs where artist_id=${artist}`;
          routeAdapter = createHostedAboutAdapter({ lore: "fail" }, buildDocSources);
          await browser("failure", "Could not prepare Lore for About");
          expect(routeAdapter.counters().about).toBe(0);
          expect(await client!`select * from artist_bio_versions order by id`).toEqual(
            historyBeforeFailure,
          );
          expect(await client!`select bio from artists where id=${artist}`).toEqual([
            { bio: "Synthetic About" },
          ]);
          expect(
            await client!`select count(*)::int as n from artist_research_jobs where status='running'`,
          ).toEqual([{ n: 0 }]);
        } finally {
          await close();
        }
      },
      180000,
    );

    it("persists actual independent route requests and preserves About on preparation and generation failures", async () => {
      await admin!.unsafe(readMigration("0065_about_writer_fence.sql"));
      try {
        await admin!`update users set privy_user_id='local-subject' where id=${user}`;
        const call = (body: object = { regenerate: true }) =>
          routes.PUT(
            new Request(`http://local.invalid/api/artistBio/${artist}`, {
              method: "PUT",
              headers: {
                Authorization: "Bearer local-synthetic",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            }),
            { params: Promise.resolve({ id: artist }) },
          );
        const read = () =>
          routes.GET(new Request(`http://local.invalid/api/artistBio/${artist}`), {
            params: Promise.resolve({ id: artist }),
          });
        routeAdapter = createHostedAboutAdapter({}, buildDocSources);
        await admin!`update users set is_admin=false where id=${user}`;
        expect((await call()).status).toBe(403);
        expect(routeAdapter.counters().lore).toBe(0);
        await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
        expect((await call()).status).toBe(200);
        expect(routeAdapter.counters()).toEqual({ lore: 1, about: 1, summary: 1 });
        expect(await (await read()).json()).toMatchObject({ bio: "Synthetic About" });
        expect((await call()).status).toBe(200);
        expect(routeAdapter.counters()).toEqual({ lore: 1, about: 2, summary: 1 });
        routeAdapter = createHostedAboutAdapter({ about: "fail" }, buildDocSources);
        const failedAbout = await call();
        expect(failedAbout.status).toBe(500);
        expect(await failedAbout.json()).toMatchObject({
          error: expect.stringContaining("existing About has been kept"),
        });
        expect(await (await read()).json()).toMatchObject({ bio: "Synthetic About" });
        await admin!`delete from artist_docs where artist_id=${artist}`;
        routeAdapter = createHostedAboutAdapter({ lore: "fail" }, buildDocSources);
        expect((await call()).status).toBe(500);
        expect(routeAdapter.counters().about).toBe(0);
        expect(await client!`select bio from artists where id=${artist}`).toEqual([
          { bio: "Synthetic About" },
        ]);
        expect(
          await client!`select count(*)::int as n from artist_research_jobs where status='running'`,
        ).toEqual([{ n: 0 }]);
        expect(
          await client!`select status,claimed_at,attempts from artist_research_jobs where status='pending'`,
        ).toEqual([{ status: "pending", claimed_at: null, attempts: 1 }]);
        // Repair through another independent request; this committed state is used by the restart runner.
        routeAdapter = createHostedAboutAdapter({}, buildDocSources);
        expect((await call()).status).toBe(200);
        expect(await (await read()).json()).toMatchObject({ bio: "Synthetic About" });
      } finally {
        await admin!.unsafe(
          "drop trigger if exists require_about_writer_version on artists; drop function if exists mn_private.require_about_writer_version()",
        );
      }
    });

    it("reads committed text, history and evidence from a fresh application connection", async () => {
      await persistArtistBio(artist, "Durable synthetic About", publication);
      const reader = postgres({ ...options, user: "mnweb", max: 1 });
      try {
        const [identity] = await reader`select current_user as role, pg_backend_pid() as pid`;
        expect(identity.role).toBe("mnweb");
        expect(backendPids.has(identity.pid)).toBe(false);
        expect(await reader`select bio from artists where id=${artist}`).toEqual([
          { bio: "Durable synthetic About" },
        ]);
        expect(
          await reader`select bio_text from artist_bio_versions where artist_id=${artist} order by bio_text`,
        ).toEqual([{ bio_text: "Durable synthetic About" }, { bio_text: "Original" }]);
        expect(
          await reader`select count(*)::int as n from mn_private.artist_bio_provenance where artist_id=${artist}`,
        ).toEqual([{ n: 1 }]);
        expect(
          await reader`select count(*)::int as n from mn_private.artist_bio_version_provenance p join artist_bio_versions v on v.id=p.version_id where v.artist_id=${artist}`,
        ).toEqual([{ n: 1 }]);
        expect(await reader`select url,policy_version from mn_private.public_url_receipts`).toEqual(
          [{ url: source.url, policy_version: 1 }],
        );
      } finally {
        await reader.end({ timeout: 1 });
      }
    });

    it("preserves an explicit legacy allowance on rollback but never revives it after claim revocation", async () => {
      await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
      await admin!`insert into mn_private.legacy_bio_publications values(${artist},${claim},encode(sha256(convert_to('Original','UTF8')),'hex'))`;
      expect(await getPublicSavedBio(artist)).toBe("Original");
      const failure = await capture(
        admin!.begin(async tx => {
          await tx`update artist_vault_sources set publication='private' where artist_id=${artist}`;
          throw new Error("Synthetic rollback");
        }),
      );
      expect(failure.error).toBeInstanceOf(Error);
      expect(await getPublicSavedBio(artist)).toBe("Original");
      await client!`update artist_claims set status='revoked' where id=${claim}`;
      await client!`update artist_claims set status='approved' where id=${claim}`;
      expect(await getPublicSavedBio(artist)).toBeNull();
      expect(await client!`select bio from artists`).toEqual([{ bio: "Original" }]);
      expect(await client!`select * from mn_private.legacy_bio_publications`).toHaveLength(0);
    });

    it("setup saves then retains Lore without consuming the legacy About allowance or pin", async () => {
      await admin!`insert into artist_claims(id,artist_id,user_id,status) values(${claim},${artist},${user},'approved')`;
      await admin!`insert into mn_private.legacy_bio_publications values(${artist},${claim},encode(sha256(convert_to('Original','UTF8')),'hex'))`;
      await admin!`insert into artist_bio_versions(artist_id,bio_text,is_pinned) values(${artist},'Pinned text',true)`;
      const ownership = { userId: user, expectedClaimId: claim };
      await persistSetupLore(artist, ownership, { content: "Setup Lore", sources }, null);
      const [snapshot] = await client!<
        { content: string; sources: unknown; updatedAt: string | null }[]
      >`select content,sources,updated_at::text as "updatedAt" from artist_docs where artist_id=${artist}`;
      const before = await client!`select * from artist_docs`;
      await persistSetupLore(artist, ownership, null, snapshot);
      expect(await client!`select * from artist_docs`).toEqual(before);
      expect(await client!`select bio from artists`).toEqual([{ bio: "Original" }]);
      expect(await client!`select bio_text,is_pinned from artist_bio_versions`).toEqual([
        { bio_text: "Pinned text", is_pinned: true },
      ]);
      expect(await getPublicSavedBio(artist)).toBe("Original");
      expect(await client!`select * from mn_private.legacy_bio_publications`).toHaveLength(1);
      expect(await client!`select * from mn_private.artist_bio_provenance`).toHaveLength(0);
      expect(await client!`select step from artist_onboarding_steps order by step`).toEqual([
        { step: "interview" },
        { step: "publish" },
      ]);
    });

    it("setup rejects a stored Lore edit committed while waiting for the artist lock", async () => {
      await client!`insert into artist_docs(artist_id,content,sources) values(${artist},'Old Lore','[]')`;
      const [snapshot] = await client!<
        { content: string; sources: unknown; updatedAt: string | null }[]
      >`select content,sources,updated_at::text as "updatedAt" from artist_docs where artist_id=${artist}`;
      const entered = deferred(),
        release = deferred();
      const holder = capture(
        competitor!.begin(async tx => {
          await tx`select id from artists where id=${artist} for update`;
          await tx`update artist_docs set content='Concurrent editor Lore' where artist_id=${artist}`;
          entered.resolve();
          await release.promise;
        }),
      );
      let waiting: ReturnType<typeof capture<void>> | undefined;
      try {
        await entered.promise;
        waiting = capture(
          persistSetupLore(artist, auth, { content: "Stale overwrite", sources }, snapshot),
        );
        await waitForBlockedWriter();
      } finally {
        release.resolve();
        await Promise.all([holder, waiting]);
      }
      expect((await holder).error).toBeUndefined();
      expect((await waiting!).error).toBeInstanceOf(LoreChangedError);
      expect(await client!`select content from artist_docs`).toEqual([
        { content: "Concurrent editor Lore" },
      ]);
      expect(await client!`select bio from artists`).toEqual([{ bio: "Original" }]);
      expect(await client!`select * from artist_onboarding_steps`).toHaveLength(0);
    });

    it.each(["rejected", "edited"])(
      "research auto-approval does not overwrite a concurrent %s source",
      async change => {
        await client!`update artist_vault_sources set status='pending',origin='research' where id=${sourceId}`;
        const [expected] = await driver!
          .select()
          .from(schema.artistVaultSources)
          .where(eq(schema.artistVaultSources.id, sourceId));
        const entered = deferred(),
          release = deferred();
        const holder = capture(
          competitor!.begin(async tx => {
            await tx`select id from artists where id=${artist} for update`;
            if (change === "rejected")
              await tx`update artist_vault_sources set status='rejected' where id=${sourceId}`;
            else
              await tx`update artist_vault_sources set extracted_text='Concurrent replacement evidence' where id=${sourceId}`;
            entered.resolve();
            await release.promise;
          }),
        );
        let waiting:
          | ReturnType<typeof capture<Awaited<ReturnType<typeof updateVaultSourceStatus>>>>
          | undefined;
        try {
          await entered.promise;
          waiting = capture(updateVaultSourceStatus(sourceId, "approved", expected));
          await waitForBlockedWriter();
        } finally {
          release.resolve();
          await Promise.all([holder, waiting]);
        }
        expect((await holder).error).toBeUndefined();
        expect(await waiting!).toEqual({ value: undefined, error: undefined });
        const [current] =
          await client!`select status,extracted_text from artist_vault_sources where id=${sourceId}`;
        expect(current.status).toBe(change === "rejected" ? "rejected" : "pending");
        if (change === "edited")
          expect(current.extracted_text).toBe("Concurrent replacement evidence");
        expect(await client!`select * from artist_research_jobs`).toHaveLength(0);
        expect(await client!`select * from artist_activity_events`).toHaveLength(1);
      },
    );

    it.each(["Dev", "Production"])(
      "native Artist Web Map guarded reads and name/id writes preserve %s policy",
      async target => {
        await persistArtistBio(artist, "Generated", publication);
        const rollback = new Error("Synthetic map fixture rollback");
        const result = await capture(
          admin!.begin(async tx => {
            // Entire replacement fixture, role and projection roll back; other native cases keep their original tables.
            await tx.unsafe("alter table public.artists rename to native_original_artists");
            await tx.unsafe(
              `create table public.artists(${webArtistManifest.columns.map(c => `"${c.name}" ${c.type}`).join(",")})`,
            );
            await tx`insert into public.artists(id,name,bio,spotify,node_pfp,webmapdata) values(${artist},'Synthetic artist','Generated','synthetic-spotify','{"url":"synthetic"}','{}')`;
            await tx.unsafe(
              "create role native_map_editor login;grant usage on schema public to native_map_editor,anon,authenticated;grant select on public.artists to native_map_editor,anon,authenticated;grant update(webmapdata) on public.artists to native_map_editor;alter table public.artists enable row level security",
            );
            if (target === "Dev")
              await tx.unsafe(
                "create policy map_read on public.artists for select to public using(true)",
              );
            else
              await tx.unsafe(
                "create policy map_read on public.artists for select to native_map_editor using(true);create policy map_update on public.artists for update to native_map_editor using(true) with check(true)",
              );
            const base = readFileSync(
              new URL("../../../docs/prototypes/guarded-about/projection.sql", import.meta.url),
              "utf8",
            );
            const cutover = buildFullArtistProjection(useExistingUrlReceipts(base), {
              reader: null,
              mapEditor: "native_map_editor",
              publicReaders: target === "Dev",
            });
            // The test supplies the transaction; don't let prototype BEGIN/COMMIT escape its rollback boundary.
            expect(cutover.startsWith("BEGIN;\n")).toBe(true);
            expect(cutover.endsWith("COMMIT;")).toBe(true);
            await tx.unsafe(cutover.slice("BEGIN;\n".length, -"COMMIT;".length));
            await tx.unsafe("set local role native_map_editor");
            const [row] =
              await tx`SELECT * FROM mn_public.artists WHERE LOWER(name)=LOWER('SYNTHETIC ARTIST')`;
            expect(Object.keys(row)).toEqual(webArtistManifest.columns.map(c => c.name));
            expect(row.bio).toBe("Generated");
            expect(
              await tx`SELECT node_pfp,spotify AS spotify_id FROM mn_public.artists WHERE id=${artist}`,
            ).toEqual([{ node_pfp: { url: "synthetic" }, spotify_id: "synthetic-spotify" }]);
            for (const denied of [
              "SELECT * FROM public.artists",
              "SELECT bio FROM public.artists",
              "SELECT node_pfp FROM public.artists",
              "UPDATE public.artists SET name='forbidden'",
              "UPDATE public.artists SET webmapdata='{}' RETURNING *",
            ]) {
              const failure = await capture(tx.savepoint(async sp => sp.unsafe(denied)));
              expect(errorCode(failure.error)).toBe("42501");
            }
            const absent = await capture(
              tx.savepoint(async sp => sp.unsafe("SELECT spotify_id FROM mn_public.artists")),
            );
            expect(errorCode(absent.error)).toBe("42703");
            await tx`UPDATE public.artists SET webmapdata=${tx.json({ via: "name" })}::jsonb WHERE LOWER(name)=LOWER('SYNTHETIC ARTIST')`;
            expect(await tx`SELECT webmapdata FROM mn_public.artists WHERE id=${artist}`).toEqual([
              { webmapdata: target === "Dev" ? {} : { via: "name" } },
            ]);
            await tx`UPDATE public.artists SET webmapdata=${tx.json({ via: "id" })}::jsonb WHERE id=${artist}`;
            expect(await tx`SELECT webmapdata FROM mn_public.artists WHERE id=${artist}`).toEqual([
              { webmapdata: target === "Dev" ? {} : { via: "id" } },
            ]);
            await tx.unsafe("reset role");
            await tx`UPDATE artist_vault_sources SET publication='private' WHERE id=${sourceId}`;
            await tx.unsafe("set local role native_map_editor");
            expect(
              await tx`SELECT bio FROM mn_public.artists WHERE LOWER(name)=LOWER('SYNTHETIC ARTIST')`,
            ).toEqual([{ bio: null }]);
            await tx.unsafe("reset role");
            expect(await tx`SELECT bio FROM public.artists`).toEqual([{ bio: "Generated" }]);
            await tx.unsafe(
              readFileSync(
                new URL(
                  "../../../docs/prototypes/guarded-about/rollback-public-bio.sql",
                  import.meta.url,
                ),
                "utf8",
              ),
            );
            await tx.unsafe("set local role native_map_editor");
            expect(await tx`SELECT bio FROM mn_public.artists`).toEqual([{ bio: null }]);
            const raw = await capture(
              tx.savepoint(async sp => sp.unsafe("SELECT bio FROM public.artists")),
            );
            expect(errorCode(raw.error)).toBe("42501");
            await tx.unsafe("reset role");
            expect(await tx`SELECT bio FROM public.artists`).toEqual([{ bio: "Generated" }]);
            throw rollback;
          }),
        );
        if (result.error !== undefined && result.error !== rollback) throw result.error;
        expect(result.error).toBe(rollback);
        expect(await admin!`select to_regclass('mn_public.artists') as relation`).toEqual([
          { relation: null },
        ]);
        expect(await getPublicSavedBio(artist)).toBe("Generated");
      },
    );

    it("rolls back private provenance schema when the history foreign-key lock times out", async () => {
      await admin!.unsafe("drop schema mn_private cascade");
      await admin!`insert into artist_bio_versions(artist_id,bio_text,is_pinned) values(${artist},'Preserved pin',true)`;
      const entered = deferred(),
        release = deferred();
      const holder = capture(
        competitor!.begin(async tx => {
          await tx`lock table artist_bio_versions in access exclusive mode`;
          entered.resolve();
          await release.promise;
        }),
      );
      await entered.promise;
      const migration = readMigration("0061_about_evidence_provenance.sql");
      try {
        const attempted = await capture(
          admin!.begin(async tx => {
            await tx`set local lock_timeout='250ms'`;
            await tx.unsafe(migration);
          }),
        );
        expect(errorCode(attempted.error)).toBe("55P03");
        expect(
          await admin!`select schema_name from information_schema.schemata where schema_name='mn_private'`,
        ).toHaveLength(0);
      } finally {
        release.resolve();
        await holder;
      }
      await admin!.begin(async tx => {
        await tx`set local lock_timeout='2s'`;
        await tx.unsafe(migration);
      });
      expect(
        await client!`select a.bio,p.provenance as bio_provenance from artists a left join mn_private.artist_bio_provenance p on p.artist_id=a.id`,
      ).toEqual([{ bio: "Original", bio_provenance: null }]);
      expect(
        await client!`select v.bio_text,v.is_pinned,p.provenance as bio_provenance from artist_bio_versions v left join mn_private.artist_bio_version_provenance p on p.version_id=v.id`,
      ).toEqual([{ bio_text: "Preserved pin", is_pinned: true, bio_provenance: null }]);
    });
  },
);
