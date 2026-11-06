import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll } from "vitest";
import { afterEach, beforeEach, expect, it } from "vitest";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
import manifest from "./productionArtistColumns.json";
import { buildProductionMapCutover } from "./buildProductionMapCutover";

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
    readFileSync(new URL("./productionMapOperatorPreflight.sql", import.meta.url), "utf8"),
    readFileSync(new URL("./productionMapPostflight.sql", import.meta.url), "utf8"),
  );
async function asRole(
  role: "mnweb" | "webmapdata_editor" | "anon" | "authenticated",
  query: string,
) {
  await pg.exec(`set role ${role}`);
  try {
    return await pg.query(query);
  } finally {
    await pg.exec("set role fixture_admin").catch(error => {
      if (error.code !== "25P02") throw error;
    });
  }
}
async function commitStage() {
  await pg.exec("begin;set local role postgres");
  await pg.exec(stage());
  await pg.exec("commit;set role fixture_admin");
}
async function absentProjection() {
  expect(
    (
      await pg.query(
        "select nspname from pg_namespace where nspname in ('mn_public','mn_projection')",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (await pg.query("select rolname from pg_roles where rolname='mn_projection_reader'")).rows,
  ).toEqual([]);
}
native("requires the enclosing migration and legacy transaction", async () => {
  await pg.exec("set role postgres");
  await expect(pg.exec(stage())).rejects.toMatchObject({ code: "25P01" });
  await pg.exec("set role fixture_admin");
  expect((await asRole("webmapdata_editor", "select bio from artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
});
native(
  "revokes raw reads as nonsuperuser without installing objects or changing saved evidence",
  async () => {
    const before = (await pg.query("select to_jsonb(a) as artist from artists a")).rows;
    const evidence = (await pg.query("select * from mn_private.artist_bio_provenance")).rows;
    await commitStage();
    await absentProjection();
    expect((await asRole("mnweb", "select to_jsonb(a) as artist from artists a")).rows).toEqual(
      before,
    );
    expect((await pg.query("select * from mn_private.artist_bio_provenance")).rows).toEqual(
      evidence,
    );
    expect(
      (
        await pg.query(
          "select has_column_privilege('webmapdata_editor','artists','webmapdata','UPDATE') as allowed",
        )
      ).rows,
    ).toEqual([{ allowed: true }]);
    for (const role of ["webmapdata_editor", "anon", "authenticated"] as const) {
      for (const query of [
        "select bio from artists",
        "select * from artists",
        "select id,name from artists",
        "select * from mn_private.public_url_receipts",
      ])
        await expect(asRole(role, query)).rejects.toMatchObject({ code: "42501" });
    }
  },
);
native("outer rollback restores prior ACLs and leaves artist text intact", async () => {
  const before = (await pg.query("select relacl::text from pg_class where oid='artists'::regclass"))
    .rows;
  await pg.exec("begin;set local role postgres");
  await pg.exec(stage());
  await pg.exec("rollback;set role fixture_admin");
  expect(
    (await pg.query("select relacl::text from pg_class where oid='artists'::regclass")).rows,
  ).toEqual(before);
  expect((await asRole("webmapdata_editor", "select bio from artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
  await absentProjection();
});
native.each([
  "create role unknown_reader login;grant select on artists to unknown_reader",
  "create role unknown_reader nologin;grant select(bio) on artists to unknown_reader",
  "create role unknown_reader nologin;grant select(bio) on artists to unknown_reader;create role unknown_operator login noinherit;grant unknown_reader to unknown_operator with inherit false",
  "create role unknown_operator login noinherit;grant supabase_read_only_user to unknown_operator with inherit false",
  "alter role cli_login_postgres inherit",
  "create role unknown_reader login;grant webmapdata_editor to unknown_reader",
  "grant mnweb to supabase_read_only_user",
])("rejects unexpected authority and rolls back retirement: %s", async change => {
  await pg.exec(change);
  await pg.exec("begin;set local role postgres");
  await expect(pg.exec(stage())).rejects.toThrow();
  await pg.exec("rollback;set role fixture_admin");
  expect((await asRole("webmapdata_editor", "select bio from artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
  await absentProjection();
});
native.each([
  "revoke all on artists from webmapdata_editor;drop policy map_update on artists;drop policy map_select on artists;drop role webmapdata_editor",
  "revoke update(webmapdata) on artists from webmapdata_editor;alter role webmapdata_editor nologin",
  "grant select(bio) on artists to webmapdata_editor;alter role webmapdata_editor nologin",
  "grant select(bio) on artists to public,anon,authenticated",
])("retires direct reads without requiring the obsolete role: %s", async change => {
  await pg.exec(change);
  await commitStage();
  await absentProjection();
  expect((await asRole("mnweb", "select bio from artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
  expect(
    (
      await pg.query(
        "select rolname from pg_roles where rolname in ('webmapdata_editor','anon','authenticated') and has_any_column_privilege(oid,'artists','SELECT')",
      )
    ).rows,
  ).toEqual([]);
});
native("does not consume unrelated default grants because it creates no objects", async () => {
  await pg.exec(
    "create role unknown_reader login;set role postgres;alter default privileges grant select on tables to unknown_reader;alter default privileges grant usage on schemas to unknown_reader;alter default privileges grant execute on functions to unknown_reader;set role fixture_admin",
  );
  const before = (
    await pg.query(
      "select defaclrole,defaclnamespace,defaclobjtype,defaclacl::text from pg_default_acl order by oid",
    )
  ).rows;
  await commitStage();
  await absentProjection();
  expect(
    (
      await pg.query(
        "select defaclrole,defaclnamespace,defaclobjtype,defaclacl::text from pg_default_acl order by oid",
      )
    ).rows,
  ).toEqual(before);
});
