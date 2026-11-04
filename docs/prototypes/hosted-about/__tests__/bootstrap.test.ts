import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
const root = new URL("../", import.meta.url);
const sql = (file: string) => readFileSync(new URL(file, root), "utf8");
async function setup() {
  const pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec(
    "create role mnweb;create role mn_bot;create role webmapdata_editor;create role anon;create role authenticated",
  );
  for (const file of [
    "fresh-schema.bootstrap.sql",
    "bootstrap-functions.sql",
    "bootstrap-reset-access.sql",
    "bootstrap-access.sql",
    "bootstrap-audit.sql",
  ])
    await pg.exec(sql(file));
  return pg;
}
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  claim = "00000000-0000-4000-8000-000000000003";
it("replays the complete baseline and installed SQL-only inventory with no seeded application data", async () => {
  const pg = await setup();
  try {
    expect((await pg.query("select count(*)::int as n from artists")).rows).toEqual([{ n: 0 }]);
    const manifest = JSON.parse(sql("bootstrap-manifest.json"));
    for (const [file, key] of [
      ["fresh-schema.bootstrap.sql", "baselineSha256"],
      ["bootstrap-functions.sql", "functionsSha256"],
    ])
      expect(createHash("sha256").update(sql(file)).digest("hex")).toBe(manifest[key]);
    expect(
      (await pg.query("select count(*)::int n from pg_trigger where not tgisinternal")).rows,
    ).toEqual([{ n: manifest.triggers.length }]);
    for (const name of manifest.functions)
      expect(
        (
          await pg.query(
            "select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=$1",
            [name],
          )
        ).rows,
      ).toHaveLength(1);
  } finally {
    await pg.close();
  }
}, 30000);
it("supports app-role Lore/history/current writes, immutable history and allowance consumption without widening anonymous access", async () => {
  const pg = await setup();
  try {
    await pg.exec(
      `insert into users(id) values('${user}');insert into artists(id,bio) values('${artist}','original');insert into artist_claims(id,user_id,artist_id,status) values('${claim}','${user}','${artist}','approved');insert into artist_vault_sources(artist_id,url,status,publication,extracted_text) values('${artist}','https://example.org/synthetic','approved','public','old evidence');insert into mn_private.legacy_bio_publications values('${artist}','${claim}',repeat('a',64));set role mnweb`,
    );
    expect((await pg.query("select id from users for share")).rows).toHaveLength(1);
    expect((await pg.query("select id from artist_claims for share")).rows).toHaveLength(1);
    expect((await pg.query("select id from artist_vault_sources for share")).rows).toHaveLength(1);
    for (const table of ["users", "artist_claims", "artist_vault_sources"])
      await expect(pg.exec(`update ${table} set id=id`)).rejects.toThrow(/row-level security/);
    await pg.exec(
      `insert into artist_docs(artist_id,content) values('${artist}','synthetic Lore');insert into artist_bio_versions(artist_id,bio_text) values('${artist}','original');reset role;update artist_vault_sources set extracted_text='new evidence',publication='private' where artist_id='${artist}';set role mnweb`,
    );
    expect(
      (await pg.query("select count(*)::int n from artist_vault_source_versions")).rows,
    ).toEqual([{ n: 1 }]);
    expect((await pg.query("select * from mn_private.legacy_bio_publications")).rows).toEqual([]);
    await pg.exec(
      `insert into mn_private.artist_bio_provenance values('${artist}','{"version":1,"kind":"unknown","bioHash":"synthetic"}')`,
    );
    await expect(
      pg.exec(
        `insert into mn_private.legacy_bio_publications values('${artist}','${claim}',repeat('a',64))`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(pg.exec("delete from artist_vault_source_versions")).rejects.toThrow(
      /permission denied/,
    );
    await pg.exec("reset role");
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      for (const table of [
        "public.artists",
        "mn_private.artist_bio_provenance",
        "mn_private.legacy_bio_publications",
      ])
        await expect(pg.exec(`select * from ${table}`)).rejects.toThrow(/permission denied/);
      await pg.exec("reset role");
    }
  } finally {
    await pg.close();
  }
}, 30000);
it("rolls back text and legacy allowance together under the app role", async () => {
  const pg = await setup();
  try {
    await pg.exec(
      `insert into users(id) values('${user}');insert into artists(id,bio) values('${artist}','original');insert into artist_claims(id,user_id,artist_id,status) values('${claim}','${user}','${artist}','approved');insert into mn_private.legacy_bio_publications values('${artist}','${claim}',repeat('a',64));set role mnweb`,
    );
    await expect(
      pg.transaction(async tx => {
        await tx.exec("update artists set bio='changed'");
        throw Error("synthetic failure");
      }),
    ).rejects.toThrow("synthetic failure");
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "original" }]);
    expect((await pg.query("select * from mn_private.legacy_bio_publications")).rows).toHaveLength(
      1,
    );
  } finally {
    await pg.close();
  }
}, 30000);
it("removes simulated hosted anonymous defaults and rejects unexpected object grants", async () => {
  const pg = new PGlite({ extensions: { pg_trgm } });
  try {
    await pg.exec(
      "create role mnweb;create role mn_bot;create role webmapdata_editor;create role anon;create role authenticated;create role unexpected;alter default privileges grant select on tables to anon,authenticated",
    );
    for (const file of [
      "fresh-schema.bootstrap.sql",
      "bootstrap-functions.sql",
      "bootstrap-reset-access.sql",
      "bootstrap-access.sql",
      "bootstrap-audit.sql",
    ])
      await pg.exec(sql(file));
    expect(
      (await pg.query("select has_table_privilege('anon','artists','SELECT') as allowed")).rows,
    ).toEqual([{ allowed: false }]);
    expect(
      (
        await pg.query(
          "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','mn_private','musicnerd_private') and p.prosecdef and has_function_privilege('mnweb',p.oid,'EXECUTE')",
        )
      ).rows,
    ).toEqual([]);
    await pg.exec("grant select on artists to unexpected");
    await expect(pg.exec(sql("bootstrap-audit.sql"))).rejects.toThrow(
      "Unexpected prototype object grants",
    );
  } finally {
    await pg.close();
  }
}, 30000);
