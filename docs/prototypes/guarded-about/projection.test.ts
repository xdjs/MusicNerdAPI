import { prepareUrlReceipt } from "./prepareUrlReceipt";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it } from "vitest";
import { projectSavedPublicBio } from "../../../lib/bio/projectSavedPublicBio";
import { publicKnowledgeUrl } from "../../../lib/knowledge/publicKnowledgeUrl";
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
 create schema mn_private;create table mn_private.legacy_bio_publications(artist_id uuid primary key,claim_id uuid not null,bio_hash text not null);revoke all on schema mn_private from public;grant usage on schema mn_private to mnweb;
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
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
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
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
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
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
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
it("hides claimed legacy and rejects unknown lineage and unsupported subset evidence", async () => {
  await pg.exec(migration);
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
  await pg.exec("delete from mn_private.artist_bio_provenance");
  expect((await visible())[0]).toMatchObject({ bio: null });
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  expect((await visible())[0]).toMatchObject({ bio: null });
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
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
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
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
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
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
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

it("matches the application for claimed evidence kinds, empty manifests and source-id validation", async () => {
  await pg.exec(migration);
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  const cases: unknown[] = [
    { ...provenance(), claimId: claim, sources: [] },
    { ...provenance(), kind: "authored", claimId: claim, sources: [] },
    { ...provenance(), claimId: claim, sources: [{ id: 1, kind: "interview", url: null }] },
    {
      ...provenance(),
      claimId: claim,
      sources: [{ id: 1, kind: "social", url: "https://example.org/post?ref=home#clip" }],
    },
    { ...provenance(), kind: "authored", claimId: null },
    { ...provenance(), claimId: "old-claim" },
    {
      ...provenance(),
      claimId: claim,
      sources: [
        { id: 1, kind: "interview", url: null },
        { id: 1.0, kind: "social", url: null },
      ],
    },
    { ...provenance(), claimId: claim, sources: [{ id: 1.1, kind: "interview", url: null }] },
    {
      ...provenance(),
      claimId: claim,
      sources: [{ id: 9007199254740992, kind: "interview", url: null }],
    },
    { ...provenance(), claimId: claim, sources: [{ id: 1, kind: "unknown", url: null }] },
    { ...provenance(), claimId: claim, sources: [{ id: 1, kind: "interview" }] },
  ];
  for (const p of cases) {
    await pg.transaction(async tx => {
      for (const item of (p as { sources?: { url?: unknown }[] }).sources ?? []) {
        if (typeof item.url === "string") await prepareUrlReceipt(tx, item.url);
      }
      await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
        JSON.stringify(p),
      ]);
    });
    expect((await visible())[0]).toMatchObject({
      bio: projectSavedPublicBio({
        bio: "Public biography",
        provenance: p,
        claimId: claim,
        evidence: [source],
      }),
    });
  }
});

it("blocks cutover when an unidentified login still has raw artist access", async () => {
  await pg.exec("create role readonly_user login;grant select on artists to readonly_user;begin");
  await expect(pg.exec(migration)).rejects.toThrow("Unexpected public raw access");
  await pg.exec("rollback");
  expect((await pg.query("select to_regclass('mn_public.artists') as view")).rows).toEqual([
    { view: null },
  ]);
});

it("blocks NOINHERIT login members that could SET ROLE into a raw reader", async () => {
  await pg.exec(
    "create role raw_reader nologin;grant select on artists to raw_reader;create role external_client login noinherit;grant raw_reader to external_client;begin",
  );
  expect(
    (
      await pg.query(
        "select has_any_column_privilege('external_client','artists','SELECT') as inherited",
      )
    ).rows,
  ).toEqual([{ inherited: false }]);
  await expect(pg.exec(migration)).rejects.toThrow("Unexpected public raw access");
  await pg.exec("rollback");
  expect((await pg.query("select to_regclass('mn_public.artists') as view")).rows).toEqual([
    { view: null },
  ]);
});

it("uses exact application WHATWG receipts across IDNA, IP, encodings and secrets", async () => {
  await pg.exec(migration);
  const longUrl =
    "https://example.org/" +
    Array.from({ length: 400 }, (_, i) =>
      createHash("sha256").update(`long-url-${i}`).digest("hex"),
    ).join("");
  expect(longUrl.length).toBeGreaterThan(10_000);
  const urls = [
    longUrl,
    "https://example.org/lore",
    "HTTP://Example.org:8080/lore?ref=home&lang=en#clip",
    "https://example.org/path%20name?title=two%20words",
    "https://example.org:0/",
    "https://example.org?ToKeN=x",
    "https://example.org?api_key=x",
    "https://example.org?signature=x",
    "https://user:pass@example.org/path",
    "https://user@example.org",
    "https://%75ser@example.org",
    "ftp://example.org/path",
    "https://example.org:99999/",
    "https://999.999.999.999/",
    "https://example.org?%74oken=x",
    "https://example.org?%72ef=home",
    "https://example.org?API%2DKEY=x",
    "https://xn--bcher-kva.example/",
    "https://例え.example/",
    "https://bücher.example/",
    "https://127.0.0.1/",
    "http://0x7f000001/",
    "http://2130706433/",
    "https://[::1]/",
    "https://[2001:db8::1]/",
    "https://[nope]/",
    "https://xn--.org/",
    "https://localhost/",
    " https://example.org/path \n",
    "https://exa\tmple.org/",
    "https://example.org/a b",
    "https:\\example.org\\path",
    "https://example.org?ref=token",
    "https://example.org?mysecret=x",
    "https://example.org?api+key=x",
    "https://example.org?%2574oken=x",
    "https://example.org?%ZZ=x",
    "https://example.org/#token=not-query",
    "javascript:alert(1)",
    "data:text/plain,hello",
    "not a URL",
  ];
  for (const url of urls) {
    const accepted = publicKnowledgeUrl(url) !== null;
    await pg.transaction(async tx => {
      await tx.exec("set local role mnweb");
      expect(await prepareUrlReceipt(tx, url), url).toBe(accepted);
      await tx.query("update artist_vault_sources set url=$1", [url]);
      const p = provenance();
      p.sources[0].url = url;
      p.sources[0].revision = vaultSourceRevision({ ...source, url });
      await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
        JSON.stringify(p),
      ]);
    });
    expect((await visible())[0], url).toMatchObject({ bio: accepted ? "Public biography" : null });
    const { rows } = await pg.query<{ count: number }>(
      "select count(*)::integer as count from mn_private.public_url_receipts where url=$1",
      [url],
    );
    expect(rows[0].count, url).toBe(accepted ? 1 : 0);
  }
});

it("fails closed on absent, invalid-version, hash-mismatched, URL-mismatched or revoked receipts", async () => {
  await pg.exec(migration);
  expect((await visible())[0]).toMatchObject({ bio: null });
  await prepareUrlReceipt(pg, source.url);
  expect((await visible())[0]).toMatchObject({ bio: "Public biography" });
  for (const alteration of [
    "policy_version=2",
    "url_hash=decode(repeat('00',32),'hex')",
    "url='https://example.org/other'",
  ]) {
    await pg.exec(`update mn_private.public_url_receipts set ${alteration}`);
    expect((await visible())[0]).toMatchObject({ bio: null });
    await pg.exec("delete from mn_private.public_url_receipts");
    await prepareUrlReceipt(pg, source.url);
  }
  await pg.exec("delete from mn_private.public_url_receipts");
  expect((await visible())[0]).toMatchObject({ bio: null });
  await prepareUrlReceipt(pg, source.url);
  // Canonically equivalent URL has different original bytes; the old receipt is insufficient.
  const url = "HTTPS://example.org/lore";
  await pg.query("update artist_vault_sources set url=$1", [url]);
  const p = provenance();
  p.sources[0].url = url;
  p.sources[0].revision = vaultSourceRevision({ ...source, url });
  await pg.query("update mn_private.artist_bio_provenance set provenance=$1", [JSON.stringify(p)]);
  expect((await visible())[0]).toMatchObject({ bio: null });
  await prepareUrlReceipt(pg, url);
  expect((await visible())[0]).toMatchObject({ bio: "Public biography" });
});

it("rolls back receipt plus evidence publication together on failure", async () => {
  await pg.exec(migration);
  const url = "https://example.org/new";
  await expect(
    pg.transaction(async tx => {
      await tx.exec("set local role mnweb");
      await prepareUrlReceipt(tx, url);
      await tx.query("update artist_vault_sources set url=$1", [url]);
      await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
        JSON.stringify({ kind: "unknown" }),
      ]);
      throw new Error("Synthetic publication failure");
    }),
  ).rejects.toThrow("Synthetic publication failure");
  expect((await pg.query("select url from artist_vault_sources")).rows).toEqual([
    { url: source.url },
  ]);
  expect((await pg.query("select * from mn_private.public_url_receipts")).rows).toEqual([]);
  expect((await pg.query("select provenance from mn_private.artist_bio_provenance")).rows).toEqual([
    { provenance: provenance() },
  ]);
});

it("denies public receipt reads and forgery and restricts trusted roles to their least privileges", async () => {
  await pg.exec(migration);
  for (const role of ["anon", "authenticated", "inherited_anon"]) {
    await pg.exec(`set role ${role}`);
    await expect(pg.query("select * from mn_private.public_url_receipts")).rejects.toMatchObject({
      code: "42501",
    });
    await expect(prepareUrlReceipt(pg, source.url)).rejects.toMatchObject({ code: "42501" });
    await pg.exec("reset role");
  }
  await pg.exec("set role mnweb");
  expect(await prepareUrlReceipt(pg, source.url)).toBe(true);
  expect((await pg.query("select url from mn_private.public_url_receipts")).rows).toEqual([
    { url: source.url },
  ]);
  for (const sql of [
    "delete from mn_private.public_url_receipts",
    "update mn_private.public_url_receipts set policy_version=2",
  ])
    await expect(pg.query(sql)).rejects.toMatchObject({ code: "42501" });
  await pg.exec("reset role;set role mn_projection_reader");
  expect((await pg.query("select url from mn_private.public_url_receipts")).rows).toEqual([
    { url: source.url },
  ]);
  await expect(prepareUrlReceipt(pg, source.url)).rejects.toMatchObject({ code: "42501" });
  await pg.exec("reset role");
});

it("rejects a conflicting hash receipt instead of reporting successful publication", async () => {
  await pg.exec(migration);
  const hash = createHash("sha256").update(source.url).digest("hex");
  await pg.query("insert into mn_private.public_url_receipts values(decode($1,'hex'),$2,1)", [
    hash,
    "https://example.org/different",
  ]);
  await expect(
    pg.transaction(async tx => {
      await tx.exec("set local role mnweb");
      await prepareUrlReceipt(tx, source.url);
      await tx.query("update artists set bio=$1", ["Must not publish"]);
    }),
  ).rejects.toThrow("URL receipt conflict: exact bytes were not persisted");
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]);
  expect((await visible())[0]).toMatchObject({ bio: null });
  expect((await pg.query("select url from mn_private.public_url_receipts")).rows).toEqual([
    { url: "https://example.org/different" },
  ]);
});
