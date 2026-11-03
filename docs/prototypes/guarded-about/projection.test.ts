import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ABOUT_EMPTY_STATE } from "../../../lib/bio/const";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
const migration = readFileSync(new URL("./projection.sql", import.meta.url), "utf8");
let pg: PGlite;
const artist = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const claim = "00000000-0000-4000-8000-000000000003";
const event = "00000000-0000-4000-8000-000000000004";
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
 create schema mn_private;revoke all on schema mn_private from public;grant usage on schema mn_private to mnweb;
 create table artists(id uuid primary key,name text,bio text);
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
  await pg.query("insert into artists values($1,$2,$3)", [
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
});
afterEach(async () => {
  await pg.close();
});
async function visible(role = "anon") {
  await pg.exec(`set role ${role}`);
  try {
    return (await pg.query("select * from mn_public.artists")).rows;
  } finally {
    await pg.exec("reset role");
  }
}
it("preserves SELECT star fields for public/authenticated/inherited clients and trusted raw reads", async () => {
  await pg.exec(migration);
  for (const role of ["anon", "authenticated", "inherited_anon"]) {
    expect(await visible(role)).toEqual([
      { id: artist, name: "Synthetic artist", bio: "Public biography" },
    ]);
    await pg.exec(`set role ${role}`);
    for (const table of ["public.artists", "mn_private.artist_bio_provenance"])
      await expect(pg.query(`select * from ${table}`)).rejects.toMatchObject({ code: "42501" });
    await expect(pg.query("update mn_public.artists set name='attack'")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(pg.query(`select mn_projection.public_bio('${artist}')`)).rejects.toMatchObject({
      code: "42501",
    });
    await pg.exec("reset role");
  }
  await pg.exec("set role mnweb");
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]);
  await pg.exec("reset role");
  const roles = (
    await pg.query(
      "select rolsuper,rolbypassrls,rolcanlogin from pg_roles where rolname='mn_projection_reader'",
    )
  ).rows;
  expect(roles).toEqual([{ rolsuper: false, rolbypassrls: false, rolcanlogin: false }]);
});
it("withdraws dynamically after source moderation/privacy/content changes and stale old-writer edits", async () => {
  await pg.exec(migration);
  for (const change of ["status='rejected'", "publication='private'", "extracted_text='Changed'"]) {
    await pg.exec(`update artist_vault_sources set ${change}`);
    expect((await visible())[0]).toMatchObject({ bio: null });
    await pg.query(
      "update artist_vault_sources set status='approved',publication='public',extracted_text=$1",
      [source.extractedText],
    );
    expect((await visible())[0]).toMatchObject({ bio: "Public biography" });
  }
  await pg.exec("set role mnweb;update artists set bio='Old writer replacement';reset role");
  expect((await visible())[0]).toMatchObject({ bio: null });
  expect((await pg.query("select bio from artists")).rows).toEqual([
    { bio: "Old writer replacement" },
  ]);
});
it("matches JavaScript revisions for nulls, quotes, Unicode, whitespace and escapes", async () => {
  await pg.exec(migration);
  for (const text of ["ordinary", 'quote" backslash\\ newline\n\t', "Björk 😀 \u2028", "\b\f\r"]) {
    await pg.query("update artist_vault_sources set extracted_text=$1", [text]);
    const [{ revision }] = (
      await pg.query<{ revision: string }>(
        "select mn_projection.revision(v) revision from artist_vault_sources v",
      )
    ).rows;
    expect(revision).toBe(vaultSourceRevision({ ...source, extractedText: text }));
  }
});
it("preserves claim-gated legacy and rejects unknown lineage and unsupported subset evidence", async () => {
  await pg.exec(migration);
  await pg.exec("delete from mn_private.artist_bio_provenance");
  expect((await visible())[0]).toMatchObject({ bio: null });
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  expect((await visible())[0]).toMatchObject({ bio: "Public biography" });
  for (const p of [
    { ...provenance(), kind: "unknown" },
    { ...provenance(), sources: [{ id: 1, kind: "interview", url: null }] },
    {
      ...provenance(),
      sources: [{ ...provenance().sources[0], url: "https://example.org/lore?token=private" }],
    },
    { version: 1, kind: ["generated"] },
  ]) {
    await pg.query(
      "insert into mn_private.artist_bio_provenance values($1,$2) on conflict(artist_id) do update set provenance=excluded.provenance",
      [artist, JSON.stringify(p)],
    );
    expect((await visible())[0]).toMatchObject({ bio: null });
  }
});
it("rechecks immutable trust and claim revocation without broadening contributor access", async () => {
  await pg.exec(migration);
  await pg.query("update artist_vault_sources set publication='inherit',activity_id=$1", [event]);
  const p = provenance();
  p.sources[0].revision = vaultSourceRevision({
    ...source,
    publication: "inherit",
    activityId: event,
  });
  await pg.query("update mn_private.artist_bio_provenance set provenance=$1", [JSON.stringify(p)]);
  expect((await visible())[0]).toMatchObject({ bio: null });
  await pg.query(
    "insert into artist_activity_events values($1,$2,$3,'user',$2,'trusted_submission','source_submission')",
    [event, artist, sourceId],
  );
  expect((await visible())[0]).toMatchObject({ bio: "Public biography" });
  await pg.exec("delete from artist_activity_events");
  expect((await visible())[0]).toMatchObject({ bio: null });
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  expect((await visible())[0]).toMatchObject({ bio: "Public biography" });
  await pg.exec("update artist_claims set status='revoked'");
  expect((await visible())[0]).toMatchObject({ bio: null });
});
it("rolls back failed migration atomically and permits fail-closed interface rollback after cutover", async () => {
  await pg.exec("begin");
  await expect(pg.exec(migration + "\nselect 1/0;")).rejects.toMatchObject({ code: "22012" });
  await pg.exec("rollback");
  expect((await pg.query("select to_regclass('mn_public.artists') as view")).rows).toEqual([
    { view: null },
  ]);
  expect(
    (await pg.query("select has_table_privilege('anon','artists','SELECT') as allowed")).rows,
  ).toEqual([{ allowed: true }]);
  // Failed pre-cutover migration leaves original behavior, not a claim of protected access.
  await pg.exec("begin;" + migration + "commit;");
  await pg.exec(
    `create or replace function mn_projection.public_bio(requested_id uuid) returns text language sql stable security definer set search_path=pg_catalog as $$select null::text$$`,
  );
  expect((await visible())[0]).toMatchObject({ id: artist, name: "Synthetic artist", bio: null });
  await pg.exec("set role anon");
  await expect(pg.query("select * from public.artists")).rejects.toMatchObject({ code: "42501" });
  await pg.exec("reset role");
  expect((await pg.query("select bio from public.artists")).rows).toEqual([
    { bio: "Public biography" },
  ]);
});
it("rejects leftover column grants instead of claiming the raw path is closed", async () => {
  await pg.exec(
    "create role raw_reader;grant select(bio) on artists to raw_reader;grant raw_reader to anon;begin",
  );
  await expect(pg.exec(migration)).rejects.toThrow("Unexpected public raw access");
  await pg.exec("rollback");
  expect((await pg.query("select to_regclass('mn_public.artists') as view")).rows).toEqual([
    { view: null },
  ]);
});

it("rejects invalid URL ports/hosts and JS whitespace/placeholder bios", async () => {
  await pg.exec(migration);
  for (const url of [
    "https://example.org:999999/lore",
    "https://999.999.999.999/lore",
    "https://xn--.org/lore",
  ]) {
    await pg.query("update artist_vault_sources set url=$1", [url]);
    const p = provenance();
    p.sources[0].url = url;
    p.sources[0].revision = vaultSourceRevision({ ...source, url });
    await pg.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(p),
    ]);
    expect((await visible())[0]).toMatchObject({ bio: null });
  }
  await pg.exec("delete from mn_private.artist_bio_provenance");
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  for (const bio of [
    "\u00a0\t\n\ufeff",
    ABOUT_EMPTY_STATE,
    "\u2003" + ABOUT_EMPTY_STATE + "\u3000",
  ]) {
    await pg.query("update artists set bio=$1", [bio]);
    expect((await visible())[0]).toMatchObject({ bio: null });
  }
});
it("serializes real date evidence independently of session DateStyle", async () => {
  await pg.exec(migration);
  await pg.exec(
    "update artist_vault_sources set published_at='2026-11-03';set datestyle='SQL,DMY'",
  );
  const [{ revision }] = (
    await pg.query<{ revision: string }>(
      "select mn_projection.revision(v) revision from artist_vault_sources v",
    )
  ).rows;
  expect(revision).toBe(vaultSourceRevision({ ...source, publishedAt: "2026-11-03" }));
});
