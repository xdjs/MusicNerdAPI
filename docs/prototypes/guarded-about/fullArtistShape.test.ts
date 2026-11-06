import { prepareUrlReceipt } from "./prepareUrlReceipt";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
import manifest from "./webArtistColumns.json";
import { buildFullArtistProjection } from "./buildFullArtistProjection";
const migration = readFileSync(new URL("./projection.sql", import.meta.url), "utf8");
let pg: PGlite;
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
  pg = new PGlite();
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
  await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
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
});
afterEach(async () => {
  await pg.close();
});
const cutover = () =>
  buildFullArtistProjection(migration, {
    reader: "readonly_user",
    mapEditor: "webmapdata_editor",
    publicReaders: true,
  });
async function asRole<T>(
  role: "readonly_user" | "webmapdata_editor" | "anon" | "authenticated",
  fn: () => Promise<T>,
) {
  await pg.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await pg.exec("reset role");
  }
}
it("preserves all 65 pinned Web names, types, order and values while masking only bio for explicitly mapped readers", async () => {
  const raw = (await pg.query<Record<string, unknown>>("select * from artists")).rows[0];
  await pg.exec(cutover());
  const columns = (
    await pg.query(
      "select attname as name,format_type(atttypid,atttypmod) as type from pg_attribute where attrelid='mn_public.artists'::regclass and attnum>0 and not attisdropped order by attnum",
    )
  ).rows;
  expect(columns).toEqual(manifest.columns);
  expect(columns).toHaveLength(65);
  for (const role of ["readonly_user", "webmapdata_editor", "anon", "authenticated"] as const) {
    await asRole(role, async () => {
      const result = (await pg.query<Record<string, unknown>>("select * from mn_public.artists"))
        .rows;
      expect(result).toEqual([{ ...raw, bio: null }]);
      expect(Object.keys(result[0])).toEqual(manifest.columns.map(c => c.name));
      await expect(pg.query("select bio from public.artists")).rejects.toMatchObject({
        code: "42501",
      });
      await expect(
        pg.query("select * from mn_private.artist_bio_provenance"),
      ).rejects.toMatchObject({ code: "42501" });
    });
  }
});
it("preserves explicit map update and narrow RETURNING without granting raw bio or other writes", async () => {
  await pg.exec(cutover());
  await asRole("webmapdata_editor", async () => {
    expect(
      (
        await pg.query(
          "update public.artists set webmapdata=$1 where id=$2 returning id,webmapdata",
          [JSON.stringify({ updated: true }), artist],
        )
      ).rows,
    ).toEqual([{ id: artist, webmapdata: { updated: true } }]);
    await expect(
      pg.query("update public.artists set webmapdata='{}' where id=$1 returning *", [artist]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      pg.query("update public.artists set bio='attack' where id=$1", [artist]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(pg.query("update mn_public.artists set name='attack'")).rejects.toMatchObject({
      code: "42501",
    });
  });
  await asRole("readonly_user", async () => {
    await expect(pg.query("update public.artists set webmapdata='{}'")).rejects.toMatchObject({
      code: "42501",
    });
  });
  expect((await pg.query("select bio,webmapdata from artists")).rows).toEqual([
    { bio: "Public biography", webmapdata: { updated: true } },
  ]);
});
it.each([
  "add column unexpected_private text",
  "rename column notes to renamed_notes",
  "alter column name type varchar(200)",
])("rejects pre-cutover schema drift without changing existing access: %s", async change => {
  await pg.exec(`alter table artists ${change}`);
  await expect(pg.exec(cutover())).rejects.toThrow("Pinned artist column contract changed");
  await pg.exec("rollback");
  await asRole("readonly_user", async () =>
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]),
  );
  expect((await pg.query("select to_regclass('mn_public.artists') as relation")).rows).toEqual([
    { relation: null },
  ]);
});
it("fails closed after a new base column appears rather than automatically exposing it", async () => {
  await pg.exec(cutover());
  await pg.exec("alter table artists add column future_private text default 'secret'");
  await asRole("readonly_user", async () => {
    await expect(
      pg.query<Record<string, unknown>>("select * from mn_public.artists"),
    ).rejects.toThrow("Pinned artist column contract changed");
    await expect(pg.query("select bio from artists")).rejects.toMatchObject({ code: "42501" });
  });
});
it("retains unknown-role grants on aborted cutover; never classifies an unknown consumer", async () => {
  await pg.exec("create role unknown_client login;grant select on artists to unknown_client");
  await expect(pg.exec(cutover())).rejects.toThrow("Unexpected public raw access");
  await pg.exec("rollback;set role unknown_client");
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]);
  await pg.exec("reset role");
  expect(
    (await pg.query("select has_table_privilege('readonly_user','artists','SELECT') as allowed"))
      .rows,
  ).toEqual([{ allowed: true }]);
});
it("emergency post-cutover rollback retains full shape and map edits while keeping raw biographies denied", async () => {
  await pg.exec(cutover());
  await pg.exec(readFileSync(new URL("./rollback-public-bio.sql", import.meta.url), "utf8"));
  await asRole("readonly_user", async () => {
    const row = (await pg.query<Record<string, unknown>>("select * from mn_public.artists"))
      .rows[0];
    expect(Object.keys(row)).toEqual(manifest.columns.map(c => c.name));
    expect(row.bio).toBeNull();
    await expect(pg.query("select bio from artists")).rejects.toMatchObject({ code: "42501" });
  });
  await asRole("webmapdata_editor", async () =>
    expect(
      (await pg.query("update artists set webmapdata='{}' where id=$1 returning id", [artist]))
        .rows,
    ).toEqual([{ id: artist }]),
  );
});

it("replicates Dev map grant without UPDATE policy: reads survive but updates remain denied by RLS", async () => {
  await pg.exec("drop policy map_update on artists");
  await pg.exec(cutover());
  await asRole("webmapdata_editor", async () => {
    expect(
      (await pg.query<Record<string, unknown>>("select * from mn_public.artists")).rows,
    ).toHaveLength(1);
    expect(
      (await pg.query("update artists set webmapdata='{}' where id=$1 returning id", [artist]))
        .rows,
    ).toEqual([]);
  });
});
it("replicates production policy visibility without granting anonymous access or assuming readonly_user exists", async () => {
  await pg.exec(
    "revoke select on artists from readonly_user;drop role readonly_user;drop policy public_read on artists;create policy map_select on artists for select to webmapdata_editor using(true)",
  );
  for (const role of ["anon", "authenticated"] as const)
    await asRole(role, async () =>
      expect((await pg.query<Record<string, unknown>>("select * from artists")).rows).toEqual([]),
    );
  await pg.exec(
    buildFullArtistProjection(migration, {
      reader: null,
      mapEditor: "webmapdata_editor",
      publicReaders: false,
    }),
  );
  for (const role of ["anon", "authenticated"] as const)
    await asRole(role, async () => {
      await expect(
        pg.query<Record<string, unknown>>("select * from mn_public.artists"),
      ).rejects.toMatchObject({
        code: "42501",
      });
      await expect(pg.query("select bio from artists")).rejects.toMatchObject({ code: "42501" });
    });
  await asRole("webmapdata_editor", async () => {
    expect(
      (await pg.query<Record<string, unknown>>("select * from mn_public.artists")).rows,
    ).toHaveLength(1);
    expect(
      (await pg.query("update artists set webmapdata='{}' where id=$1 returning id", [artist]))
        .rows,
    ).toEqual([{ id: artist }]);
  });
});
it("refuses reserved or truncated client role names and broad map UPDATE grants", async () => {
  for (const reader of ["postgres", "service_role", "pg_read_all_data", "a".repeat(64)])
    expect(() =>
      buildFullArtistProjection(migration, {
        reader,
        mapEditor: "webmapdata_editor",
        publicReaders: false,
      }),
    ).toThrow("Explicit independent audited role required");
  await pg.exec("grant update on artists to webmapdata_editor");
  await expect(pg.exec(cutover())).rejects.toThrow("Map role has broader privileges");
  await pg.exec("rollback");
  expect(
    (
      await pg.query(
        "select has_table_privilege('webmapdata_editor','artists','UPDATE') as allowed",
      )
    ).rows,
  ).toEqual([{ allowed: true }]);
});

it("rejects denied public roles able to SET ROLE into an explicitly mapped reader", async () => {
  await pg.exec("alter role anon noinherit;grant webmapdata_editor to anon");
  await expect(
    pg.exec(
      buildFullArtistProjection(migration, {
        reader: "readonly_user",
        mapEditor: "webmapdata_editor",
        publicReaders: false,
      }),
    ),
  ).rejects.toThrow("Denied public role can assume an approved reader");
  await pg.exec("rollback");
  expect((await pg.query("select to_regclass('mn_public.artists') as relation")).rows).toEqual([
    { relation: null },
  ]);
});
it("returns eligible About through the full shape and withdraws it after source moderation", async () => {
  await pg.exec(cutover());
  await prepareUrlReceipt(pg, source.url);
  await asRole("readonly_user", async () =>
    expect((await pg.query("select bio from mn_public.artists")).rows).toEqual([
      { bio: "Public biography" },
    ]),
  );
  await pg.exec("update artist_vault_sources set status='rejected'");
  await asRole("readonly_user", async () =>
    expect((await pg.query("select bio from mn_public.artists")).rows).toEqual([{ bio: null }]),
  );
});

it.each(["Dev", "Production"])(
  "supports pinned Artist Web Map queries with guarded reads and existing %s write policy",
  async target => {
    if (target === "Dev") await pg.exec("drop policy map_update on artists");
    else
      await pg.exec(
        "revoke select on artists from readonly_user;drop role readonly_user;drop policy public_read on artists;create policy map_select on artists for select to webmapdata_editor using(true)",
      );
    await pg.exec(
      buildFullArtistProjection(migration, {
        reader: target === "Dev" ? "readonly_user" : null,
        mapEditor: "webmapdata_editor",
        publicReaders: target === "Dev",
      }),
    );
    await prepareUrlReceipt(pg, source.url);
    const original = (await pg.query<{ webmapdata: unknown }>("select webmapdata from artists"))
      .rows[0];
    await asRole("webmapdata_editor", async () => {
      const rows = (
        await pg.query<Record<string, unknown>>(
          "SELECT * FROM mn_public.artists WHERE LOWER(name) = LOWER($1)",
          ["SYNTHETIC ARTIST"],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].bio).toBe("Public biography");
      expect(Object.keys(rows[0])).toEqual(manifest.columns.map(column => column.name));
      expect(
        (
          await pg.query("SELECT id, name, webmapdata FROM mn_public.artists WHERE id = $1", [
            artist,
          ])
        ).rows,
      ).toEqual([{ id: artist, name: "Synthetic artist", ...original }]);
      expect(
        (
          await pg.query("SELECT id FROM mn_public.artists WHERE LOWER(name) = LOWER($1)", [
            "SYNTHETIC ARTIST",
          ])
        ).rows,
      ).toEqual([{ id: artist }]);
      expect(
        (
          await pg.query(
            "SELECT id, name, spotify, node_pfp, webmapdata, x, instagram, facebook FROM mn_public.artists WHERE LOWER(name) = LOWER($1)",
            ["SYNTHETIC ARTIST"],
          )
        ).rows,
      ).toEqual([
        {
          id: artist,
          name: "Synthetic artist",
          spotify: "synthetic-spotify",
          node_pfp: { marker: "node_pfp" },
          ...original,
          x: "synthetic-x",
          instagram: "synthetic-instagram",
          facebook: "synthetic-facebook",
        },
      ]);
      expect(
        (
          await pg.query(
            "SELECT node_pfp, spotify AS spotify_id FROM mn_public.artists WHERE id=$1",
            [artist],
          )
        ).rows,
      ).toEqual([{ node_pfp: { marker: "node_pfp" }, spotify_id: "synthetic-spotify" }]);
      // The pinned consumer also contains spotify_id, absent from the pinned database contract.
      await expect(
        pg.query("SELECT node_pfp, spotify_id FROM mn_public.artists WHERE id=$1", [artist]),
      ).rejects.toMatchObject({ code: "42703" });
      for (const query of [
        "SELECT * FROM public.artists",
        "SELECT bio FROM public.artists",
        "SELECT node_pfp FROM public.artists",
      ])
        await expect(pg.query(query)).rejects.toMatchObject({ code: "42501" });
      await pg.query("UPDATE public.artists SET webmapdata = $1 WHERE LOWER(name) = LOWER($2)", [
        JSON.stringify({ via: "name" }),
        "SYNTHETIC ARTIST",
      ]);
      expect(
        (await pg.query("SELECT webmapdata FROM mn_public.artists WHERE id=$1", [artist])).rows,
      ).toEqual([target === "Dev" ? original : { webmapdata: { via: "name" } }]);
      await pg.query("UPDATE public.artists SET webmapdata = $1 WHERE id = $2", [
        JSON.stringify({ via: "id" }),
        artist,
      ]);
      expect(
        (await pg.query("SELECT webmapdata FROM mn_public.artists WHERE id=$1", [artist])).rows,
      ).toEqual([target === "Dev" ? original : { webmapdata: { via: "id" } }]);
      await expect(
        pg.query("UPDATE public.artists SET name='forbidden' WHERE id=$1", [artist]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        pg.query(
          "UPDATE public.artists SET webmapdata='{}' WHERE LOWER(name)=LOWER($1) RETURNING *",
          ["Synthetic artist"],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    await pg.exec("update artist_vault_sources set publication='private'");
    await asRole("webmapdata_editor", async () => {
      const [withdrawn] = (
        await pg.query<Record<string, unknown>>(
          "SELECT * FROM mn_public.artists WHERE LOWER(name)=LOWER($1)",
          ["SYNTHETIC ARTIST"],
        )
      ).rows;
      expect(withdrawn.bio).toBeNull();
      expect(withdrawn.name).toBe("Synthetic artist");
      await expect(pg.query("SELECT bio FROM public.artists")).rejects.toMatchObject({
        code: "42501",
      });
    });
    expect((await pg.query("SELECT bio FROM public.artists")).rows).toEqual([
      { bio: "Public biography" },
    ]);
  },
);

it("refuses emergency fallback before the guarded projection is installed", async () => {
  await expect(
    pg.exec(readFileSync(new URL("./rollback-public-bio.sql", import.meta.url), "utf8")),
  ).rejects.toThrow("Expected guarded projection");
});
it("refuses emergency fallback when the projector owner differs", async () => {
  await pg.exec(cutover());
  await pg.exec("alter function mn_projection.public_bio(uuid) owner to postgres");
  await expect(
    pg.exec(readFileSync(new URL("./rollback-public-bio.sql", import.meta.url), "utf8")),
  ).rejects.toThrow("Expected guarded projection");
});
