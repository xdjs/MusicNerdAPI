import { readFileSync, realpathSync } from "node:fs";
import { userInfo } from "node:os";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getTableColumns, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { BioConflictError } from "@/lib/bio/BioConflictError";
import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";

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
const database = {
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
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { persistArtistBio } = await import("../persistArtistBio");
const { resetClaimBuild } = await import("@/lib/claimBuild/resetClaimBuild");
const { reserveAboutLoreRefresh } = await import("../reserveAboutLoreRefresh");
const { finishAboutLoreRefresh } = await import("../finishAboutLoreRefresh");
const { getPublicSavedBio } = await import("../getPublicSavedBio");
const { insertVaultSource } = await import("@/lib/vault/insertVaultSource");
const { updateVaultSourceStatus } = await import("@/lib/vault/updateVaultSourceStatus");

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
            const type = "enumValues" in c && Array.isArray(c.enumValues) ? "text" : c.getSQLType();
            const defaultValue =
              c.name === "id"
                ? " primary key default gen_random_uuid()"
                : c.name === "created_at" || c.name === "updated_at"
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
      for (const file of ["0060_source_publication.sql", "0061_about_evidence_provenance.sql"])
        await admin!.unsafe(readFileSync(`/tmp/mn-about-trusted-web/drizzle/${file}`, "utf8"));
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
        `truncate mn_private.artist_bio_provenance,mn_private.artist_bio_version_provenance,${Object.keys(tables).join(",")}`,
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
            competitor!.begin(async tx => {
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
          await competitor!`update artist_activity_events set actor_user_id=null where id=${event}`;
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
        for (const table of ["artist_bio_provenance", "artist_bio_version_provenance"]) {
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
      const migration = readFileSync(
        "/tmp/mn-about-trusted-web/drizzle/0061_about_evidence_provenance.sql",
        "utf8",
      );
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
