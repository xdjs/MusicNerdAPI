import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { prepareBioUrlReceipts } from "../prepareBioUrlReceipts";
import { saveBioVersions } from "../saveBioVersions";
import { writeBioProvenance } from "../writeBioProvenance";
let pg: PGlite;
const artist = "00000000-0000-4000-8000-000000000001";
const url = "https://例え.example/evidence?ref=O'Reilly";
const provenance = { version: 1, kind: "generated", sources: [{ url }, { url }] };
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(
    "create schema mn_private;create table mn_private.public_url_receipts(url_hash bytea,url text,policy_version integer,primary key(url_hash,policy_version));create table artist_bio_versions(id uuid default gen_random_uuid(),artist_id uuid,bio_text text,is_pinned boolean);create table mn_private.artist_bio_version_provenance(version_id uuid,provenance jsonb);create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb)",
  );
});
afterEach(async () => {
  await pg.close();
});
it("prepares exact receipts for current and history writes including deduplicated historical versions", async () => {
  const db = drizzle(pg);
  await db.transaction(async tx => {
    await writeBioProvenance(tx as never, artist, provenance);
    await saveBioVersions(tx as never, artist, ["Historical"], [provenance]);
  });
  expect(
    (
      await pg.query(
        "select encode(url_hash,'hex') as hash,url,policy_version from mn_private.public_url_receipts",
      )
    ).rows,
  ).toEqual([{ hash: createHash("sha256").update(url).digest("hex"), url, policy_version: 1 }]);
  await pg.exec("delete from mn_private.public_url_receipts");
  await db.transaction(tx => saveBioVersions(tx as never, artist, ["Historical"], [provenance]));
  expect((await pg.query("select * from artist_bio_versions")).rows).toHaveLength(1);
  expect((await pg.query("select url from mn_private.public_url_receipts")).rows).toEqual([
    { url },
  ]);
});
it("skips policy-rejected or unrepresentable historical URLs without blocking lineage preservation", async () => {
  const lineage = { sources: [{ url: "https://example.org/?token=secret" }, { url: null }] };
  await prepareBioUrlReceipts(drizzle(pg) as never, {
    sources: [{ url: "https://example.org/\0" }, { url: "https://example.org/\ud800" }],
  });
  await drizzle(pg).transaction(tx => writeBioProvenance(tx as never, artist, lineage));
  expect((await pg.query("select * from mn_private.public_url_receipts")).rows).toEqual([]);
  expect(
    (await pg.query("select count(*)::integer as n from mn_private.artist_bio_provenance")).rows,
  ).toEqual([{ n: 1 }]);
});
it("throws on conflicting stored bytes and rolls earlier history writes back", async () => {
  await pg.query(
    "insert into mn_private.public_url_receipts values(decode($1,'hex'),'https://example.org/other',1)",
    [createHash("sha256").update(url).digest("hex")],
  );
  await expect(
    drizzle(pg).transaction(async tx => {
      await saveBioVersions(tx as never, artist, ["Earlier history"], [null]);
      await writeBioProvenance(tx as never, artist, provenance);
    }),
  ).rejects.toThrow("URL receipt conflict");
  expect((await pg.query("select * from artist_bio_versions")).rows).toEqual([]);
});
it("propagates receipt storage failure and makes no partial current/history write", async () => {
  await pg.exec("drop table mn_private.public_url_receipts");
  await expect(
    drizzle(pg).transaction(tx => saveBioVersions(tx as never, artist, ["New"], [provenance])),
  ).rejects.toThrow();
  expect((await pg.query("select * from artist_bio_versions")).rows).toEqual([]);
});
it("ignores absent or malformed manifests without read-time repair", async () => {
  const db = drizzle(pg);
  for (const p of [null, {}, { sources: null }, { sources: [null, 1, { url: 4 }] }])
    await prepareBioUrlReceipts(db as never, p);
  expect((await pg.query("select * from mn_private.public_url_receipts")).rows).toEqual([]);
});

it("sanitizes database failures without preserving raw URL parameters or causes", async () => {
  const tx = {
    execute: async () => {
      throw Object.assign(new Error("raw private URL: " + url), {
        query: "insert",
        params: [url],
        cause: { url },
      });
    },
  };
  const error = await prepareBioUrlReceipts(tx as never, provenance).catch(error => error as Error);
  expect(error).toBeInstanceOf(Error);
  if (!(error instanceof Error)) throw new Error("Expected sanitized failure");
  expect(error.message).toBe("Could not prepare About URL receipts");
  expect(error).not.toHaveProperty("cause");
  expect(error).not.toHaveProperty("params");
  expect(String(error) + JSON.stringify(error)).not.toContain(url);
});
