import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll } from "vitest";
import { afterEach, beforeEach, expect, it } from "vitest";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
import manifest from "./productionArtistColumns.json";
import { buildProductionMapCutover } from "./buildProductionMapCutover";

const migration = readFileSync(new URL("./projection.sql", import.meta.url), "utf8");
const socket = process.env.MN_1655_TARGET_SOCKET;
const native = socket ? it : it.skip;
if (socket && !/^\/tmp\/mn1655-map-native-[A-Za-z0-9]+\/socket$/.test(socket))
  throw new Error("Owned local socket required");
const admin = socket
  ? postgres({
      host: socket,
      port: 6546,
      user: "fixture_admin",
      database: "postgres",
      max: 1,
      prepare: false,
      onnotice: () => {},
    })
  : null;
beforeAll(async () => {
  if (!admin || !socket) return;
  const [identity] =
    await admin`select current_user as actor,current_setting('data_directory') as directory,current_setting('listen_addresses') as addresses,current_setting('server_version_num') as version,shobj_description(oid,'pg_database') as marker from pg_database where datname=current_database()`;
  expect(identity.actor).toBe("fixture_admin");
  expect(identity.addresses).toBe("");
  expect(identity.version).toMatch(/^17[0-9]{4}$/);
  expect(identity.marker).toBe("mn1655-target-fixture-only");
  expect(realpathSync(identity.directory)).toBe(realpathSync(`${socket}/../data`));
});
let connection: ReturnType<typeof postgres>;
let pg: {
  exec(sql: string): Promise<unknown>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
};
afterAll(async () => {
  await admin?.end();
});
const artist = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const source = {
  id: sourceId,
  activityId: null,
  origin: "submission",
  publication: "public",
  url: "https://example.org/lore",
  extractedText: "Synthetic evidence",
  title: null,
  snippet: null,
  publishedAt: null,
  filePath: null,
};
const provenance = () => ({
  version: 1,
  kind: "generated",
  claimId: null,
  bioHash: createHash("sha256").update("Public biography").digest("hex"),
  sources: [{ id: 1, kind: "vault", url: source.url, revision: vaultSourceRevision(source) }],
});
beforeEach(async () => {
  if (!admin || !socket) return;
  await admin.unsafe("create database target_fixture");
  connection = postgres({
    host: socket,
    port: 6546,
    user: "fixture_admin",
    database: "target_fixture",
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  pg = {
    exec: sql => connection.unsafe(sql),
    query: async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => ({
      rows: (await connection.unsafe(sql, params as never[])) as unknown as T[],
    }),
  };
  await pg.exec("create role postgres login createrole createdb bypassrls");
  await pg.exec(`create role anon;create role authenticated;create role mnweb;create role inherited_anon;grant anon to inherited_anon;
 create schema mn_private;create table mn_private.legacy_bio_publications(artist_id uuid primary key,claim_id uuid not null,bio_hash text not null);revoke all on schema mn_private from public;grant usage on schema mn_private to mnweb;
 create table artists(${manifest.columns.map(c => `"${c.name}" ${c.type}`).join(",")});
 create table artist_claims(id uuid,artist_id uuid,status text);
 create table artist_vault_sources(id uuid,artist_id uuid,activity_id uuid,origin text,publication text,status text,url text,extracted_text text,title text,snippet text,published_at date,file_path text);
 create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,actor_user_id uuid,trigger text,action text);
 create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb not null);
 grant usage on schema public to public;grant select on artists to anon,authenticated;
 grant select,insert,update,delete on artists,artist_claims,artist_vault_sources,artist_activity_events,mn_private.artist_bio_provenance to mnweb;
 alter table artists enable row level security;create policy public_read on artists for select to public using(true);create policy app on artists to mnweb using(true) with check(true);`);
  for (const table of [
    "artist_claims",
    "artist_vault_sources",
    "artist_activity_events",
    "mn_private.artist_bio_provenance",
  ])
    await pg.exec(
      `alter table ${table} enable row level security;create policy app on ${table} to mnweb using(true) with check(true)`,
    );
  await pg.query("insert into artists(id,name,bio) values($1,$2,$3)", [
    artist,
    "Synthetic artist",
    "Public biography",
  ]);
  await pg.query(
    "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'submission','public','approved',$3,$4)",
    [sourceId, artist, source.url, source.extractedText],
  );
  await pg.query("insert into mn_private.artist_bio_provenance values($1,$2::text::jsonb)", [
    artist,
    JSON.stringify(provenance()),
  ]);
  await pg.exec(
    "create role readonly_user login;create role webmapdata_editor login;grant select on artists to readonly_user,webmapdata_editor;grant update(webmapdata) on artists to webmapdata_editor;create policy map_update on artists for update to webmapdata_editor using(true) with check(true)",
  );
  for (const column of manifest.columns) {
    if (["id", "name", "bio"].includes(column.name)) continue;
    const value =
      column.type === "jsonb"
        ? JSON.stringify({ marker: column.name })
        : column.type === "text[]"
          ? ["synthetic", column.name]
          : column.type === "uuid"
            ? artist
            : column.type === "integer"
              ? 7
              : column.type === "boolean"
                ? true
                : column.type === "timestamp with time zone"
                  ? "2026-11-04T00:00:00Z"
                  : `synthetic-${column.name}`;
    await pg.query(`update artists set "${column.name}"=$1`, [value]);
  }
  await pg.exec(
    "revoke select on artists from readonly_user;drop role readonly_user;drop policy public_read on artists;create policy map_select on artists for select to webmapdata_editor using(true)",
  );
  await pg.exec(
    readFileSync(new URL("./fixtures/0062_public_url_receipts.sql", import.meta.url), "utf8"),
  );
  await pg.exec(`create role supabase_privileged_role;create role supabase_admin superuser bypassrls login createrole createdb replication;create role supabase_etl_admin login bypassrls replication;create role supabase_read_only_user login bypassrls;create role cli_login_postgres login noinherit;
    grant pg_read_all_data,pg_monitor,postgres,supabase_privileged_role to supabase_admin with admin option;
    set role supabase_admin;
    grant pg_read_all_data,pg_monitor to supabase_etl_admin,supabase_read_only_user granted by supabase_admin;
    grant supabase_privileged_role to supabase_etl_admin granted by supabase_admin;
    grant postgres to cli_login_postgres with inherit false granted by supabase_admin;
    set role fixture_admin;
    alter role postgres nosuperuser bypassrls login createrole createdb;`);
  await pg.exec(`alter database target_fixture owner to postgres;alter schema mn_private owner to postgres;
    do $$ declare t record;begin for t in select schemaname,tablename from pg_tables where schemaname in ('public','mn_private') loop execute format('alter table %I.%I owner to postgres',t.schemaname,t.tablename);end loop;end $$;`);
});
afterEach(async () => {
  if (!admin) return;
  await connection?.end();
  await admin.unsafe("drop database if exists target_fixture with (force)");
  await admin.unsafe(
    "drop role if exists unknown_reader,unknown_operator,mn_projection_reader,cli_login_postgres,supabase_etl_admin,supabase_read_only_user,supabase_admin,supabase_privileged_role,webmapdata_editor,readonly_user,mnweb,anon,authenticated,inherited_anon,postgres",
  );
});
const stage = () =>
  buildProductionMapCutover(
    migration,
    readFileSync(new URL("./productionMapOperatorPreflight.sql", import.meta.url), "utf8"),
    readFileSync(new URL("./productionMapPostflight.sql", import.meta.url), "utf8"),
  );
async function asMap(query: string, params: unknown[] = []) {
  await pg.exec("set role webmapdata_editor");
  try {
    return await pg.query(query, params);
  } finally {
    await pg.exec("set role fixture_admin");
  }
}
native(
  "preserves production order, search masking and existing name/id writes in the outer transaction",
  async () => {
    await pg.exec("begin;set local role postgres");
    await pg.exec(stage());
    expect(
      (
        await asMap("select id,name,bio from mn_public.artists where lower(name)=lower($1)", [
          "Synthetic artist",
        ])
      ).rows,
    ).toEqual([{ id: artist, name: "Synthetic artist", bio: null }]);
    expect(
      (
        await pg.query(
          "select attname from pg_attribute where attrelid='mn_public.artists'::regclass and attnum>0 and not attisdropped order by attnum",
        )
      ).rows.map(r => r.attname),
    ).toEqual(manifest.columns.map(c => c.name));
    expect(
      (
        await asMap(
          "update public.artists set webmapdata='{}' where lower(name)=lower($1) returning id",
          ["Synthetic artist"],
        )
      ).rows,
    ).toEqual([{ id: artist }]);
    await pg.exec("rollback");
    expect((await pg.query("select to_regclass('mn_public.artists') as relation")).rows).toEqual([
      { relation: null },
    ]);
    expect((await asMap("select bio from public.artists")).rows).toEqual([
      { bio: "Public biography" },
    ]);
  },
);
native.each([
  "create role unknown_reader login;grant select on artists to unknown_reader",
  "create role unknown_operator login noinherit;grant supabase_read_only_user to unknown_operator with inherit false",
  "alter role cli_login_postgres inherit",
  "grant update(node_pfp) on artists to webmapdata_editor",
  "grant mnweb to supabase_read_only_user",
  "create role unknown_reader login;set role postgres;alter default privileges grant select on tables to unknown_reader;alter default privileges grant usage on schemas to unknown_reader;set role fixture_admin",
  "create role unknown_reader login;set role postgres;alter default privileges grant execute on functions to unknown_reader;set role fixture_admin",
  "create role unknown_reader login;set role postgres;alter default privileges grant select on tables to webmapdata_editor with grant option;set role fixture_admin",
])("refuses drift atomically without changing existing access: %s", async change => {
  await pg.exec(change);
  await pg.exec("begin;set local role postgres");
  await expect(pg.exec(stage())).rejects.toThrow();
  await pg.exec("rollback");
  expect((await asMap("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]);
  expect((await pg.query("select to_regclass('mn_public.artists') as relation")).rows).toEqual([
    { relation: null },
  ]);
});
native(
  "denies raw biography/private receipts and broad writes after committed cutover",
  async () => {
    await pg.exec("begin;set local role postgres");
    await pg.exec(stage());
    await pg.exec("commit");
    for (const sql of [
      "select bio from artists",
      "select * from mn_private.public_url_receipts",
      "update artists set node_pfp='{}'",
      "insert into artists(name) values('forbidden')",
      "select * from mn_public.artists",
    ]) {
      if (sql.includes("mn_public")) {
        await pg.exec("set role anon");
        await expect(pg.query(sql)).rejects.toMatchObject({ code: "42501" });
        await pg.exec("set role fixture_admin");
      } else await expect(asMap(sql)).rejects.toMatchObject({ code: "42501" });
    }
    const rollback = readFileSync(new URL("./rollback-public-bio.sql", import.meta.url), "utf8");
    await pg.exec(rollback);
    expect((await asMap("select bio from mn_public.artists")).rows).toEqual([{ bio: null }]);
  },
);
native(
  "executes as the non-superuser production owner rather than relying on fixture superuser",
  async () => {
    await pg.exec(`alter database target_fixture owner to postgres;alter schema mn_private owner to postgres;
  do $$ declare t record; begin for t in select schemaname,tablename from pg_tables where schemaname in ('public','mn_private') loop execute format('alter table %I.%I owner to postgres',t.schemaname,t.tablename);end loop;end $$;
  set role postgres;begin;`);
    await pg.exec(stage());
    await pg.exec("commit;set role fixture_admin");
    expect((await asMap("select id from mn_public.artists")).rows).toEqual([{ id: artist }]);
    expect(
      (
        await pg.query(
          "select pg_has_role('postgres','mn_projection_reader','SET') as can_set,pg_has_role('postgres','mn_projection_reader','USAGE') as inherited",
        )
      ).rows,
    ).toEqual([{ can_set: false, inherited: false }]);
  },
);

native(
  "serves evidenced bio then hides it on source withdrawal without changing stored text",
  async () => {
    await pg.query(
      "insert into mn_private.public_url_receipts values(sha256(convert_to($1,'UTF8')),$1,1)",
      [source.url],
    );
    await pg.exec("begin;set local role postgres");
    await pg.exec(stage());
    await pg.exec("commit;set role fixture_admin");
    expect((await asMap("select bio from mn_public.artists")).rows).toEqual([
      { bio: "Public biography" },
    ]);
    await pg.exec("update artist_vault_sources set publication='private'");
    expect((await asMap("select bio from mn_public.artists")).rows).toEqual([{ bio: null }]);
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]);
  },
);
native("rejects unexpected schema USAGE independently of view privileges", async () => {
  await pg.exec("create role unknown_reader login;begin;set local role postgres");
  const sql = buildProductionMapCutover(
    migration,
    readFileSync(new URL("./productionMapOperatorPreflight.sql", import.meta.url), "utf8"),
    "GRANT USAGE ON SCHEMA mn_public TO unknown_reader;\n" +
      readFileSync(new URL("./productionMapPostflight.sql", import.meta.url), "utf8"),
  );
  await expect(pg.exec(sql)).rejects.toThrow("Unexpected projection schema access");
  await pg.exec("rollback;set role fixture_admin");
  expect((await asMap("select bio from public.artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
});
native("rejects unexpected default view SELECT independently of schema privileges", async () => {
  await pg.exec(
    "create role unknown_reader login;set role postgres;alter default privileges grant select on tables to unknown_reader;set role fixture_admin;begin;set local role postgres",
  );
  await expect(pg.exec(stage())).rejects.toThrow("Unexpected projection view access");
  await pg.exec("rollback;set role fixture_admin");
  expect((await asMap("select bio from public.artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
});
