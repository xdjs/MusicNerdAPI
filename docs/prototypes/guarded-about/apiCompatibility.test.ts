import { prepareUrlReceipt } from "./prepareUrlReceipt";
/** Handler integration through a TEST-ONLY SQL adapter. No server, PostgREST or native PG17 proof. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ABOUT_EMPTY_STATE } from "../../../lib/bio/const";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
import { getArtistBioHandler } from "../../../lib/bio/getArtistBioHandler";
import { findArtistHandler } from "../../../lib/artistLookups/findArtistHandler";
import { lookupArtists } from "../../../lib/artistLookups/lookupArtists";
import { toArtistDetail } from "../../../lib/mcp/toArtistDetail";
import type { ArtistRow } from "../../../lib/artists/types";
const mocks = vi.hoisted(() => ({
  saved: vi.fn(),
  directory: vi.fn(),
  artist: vi.fn(),
  lookup: vi.fn(),
  links: vi.fn(),
  forbidden: vi.fn(() => {
    throw new Error("Unexpected auth/provider/database operation");
  }),
}));
vi.mock("@/lib/bio/getPublicSavedBio", () => ({ getPublicSavedBio: mocks.saved }));
vi.mock("@/lib/bio/getPublicArtistAbout", () => ({ getPublicArtistAbout: mocks.directory }));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: mocks.artist }));
vi.mock("@/lib/artistLookups/findArtistByColumn", () => ({ findArtistByColumn: mocks.lookup }));
vi.mock("@/lib/artists/getArtistLinks", () => ({ getArtistLinks: mocks.links }));
vi.mock("@/lib/auth/validateArtistEditRequest", () => ({
  validateArtistEditRequest: mocks.forbidden,
}));
vi.mock("@/lib/bio/generateArtistBio", () => ({ generateArtistBio: mocks.forbidden }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: mocks.forbidden }));
vi.mock("@/lib/db/db", () => ({ db: new Proxy({}, { get: mocks.forbidden }) }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
const rawArtist = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic artist",
  bio: "RAW_PRIVATE_SENTINEL",
  spotify: "synthetic",
};
const migration = readFileSync(new URL("./projection.sql", import.meta.url), "utf8");
let pg: PGlite;
const artist = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const claim = "00000000-0000-4000-8000-000000000003";
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
  vi.clearAllMocks();
  mocks.directory.mockResolvedValue(null);
  mocks.artist.mockResolvedValue(rawArtist);
  mocks.lookup.mockResolvedValue(rawArtist);
  mocks.links.mockResolvedValue([]);
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
  await pg.exec(migration);
  await pg.transaction(async tx => {
    await prepareUrlReceipt(tx, source.url);
    await tx.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify(provenance()),
    ]);
  });
  mocks.saved.mockImplementation(async (id: string) => {
    await pg.exec("set role anon");
    try {
      const result = await pg.query<{ bio: string | null }>(
        "select bio from mn_public.artists where id=$1",
        [id],
      );
      return result.rows[0]?.bio ?? null;
    } finally {
      await pg.exec("reset role");
    }
  });
});
afterEach(async () => {
  await pg.close();
});

async function checkResponses(expected: string | null, directory: { bio: string } | null = null) {
  const response = await getArtistBioHandler(
    new Request("https://test.invalid/api/artistBio/" + artist),
    artist,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({
    status: "ok",
    bio: expected ?? ABOUT_EMPTY_STATE,
    publicAbout: directory,
  });
  const lookup = await findArtistHandler(
    new Request("https://test.invalid/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotify: "synthetic" }),
    }),
    "spotify",
    lookupArtists.spotify,
    "Missing spotify",
  );
  expect(lookup.status).toBe(200);
  expect(lookup.headers.get("cache-control")).toBe("private, no-store");
  const body = await lookup.json();
  expect(body).toEqual({ result: { ...rawArtist, bio: expected } });
  const detail = await toArtistDetail(rawArtist as ArtistRow);
  expect(detail).toEqual({
    id: artist,
    name: rawArtist.name,
    bio: expected,
    spotifyId: "synthetic",
    deezerId: null,
    socialLinks: {},
  });
  expect(JSON.stringify([body, detail])).not.toMatch(
    /RAW_PRIVATE_SENTINEL|bioHash|provenance|Synthetic evidence/,
  );
  expect(mocks.forbidden).not.toHaveBeenCalled();
}
it("integrates visible SQL-projected About with real read/lookup/MCP shapes", async () => {
  await checkResponses("Public biography");
  expect(mocks.directory).not.toHaveBeenCalled();
});
it("withdraws across handlers when evidence becomes private or rejected, retaining raw storage", async () => {
  for (const change of ["publication='private'", "publication='public',status='rejected'"]) {
    await pg.exec(`update artist_vault_sources set ${change}`);
    await checkResponses(null);
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Public biography" }]);
  }
});
it("hides claimed legacy and uses the eligible directory fallback only when available", async () => {
  await pg.exec("delete from mn_private.artist_bio_provenance");
  mocks.directory.mockResolvedValue({ bio: "Directory fallback" });
  await checkResponses("Directory fallback", { bio: "Directory fallback" });
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  mocks.directory.mockResolvedValue(null);
  await checkResponses(null);
});
it("returns existing 404 contracts for missing artists without attempting generation", async () => {
  mocks.artist.mockResolvedValue(undefined);
  mocks.lookup.mockResolvedValue(undefined);
  const response = await getArtistBioHandler(new Request("https://test.invalid/read"), artist);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ status: "error", error: "Artist not found" });
  const lookup = await findArtistHandler(
    new Request("https://test.invalid/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spotify: "missing" }),
    }),
    "spotify",
    lookupArtists.spotify,
    "Missing spotify",
  );
  expect(lookup.status).toBe(404);
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(mocks.forbidden).not.toHaveBeenCalled();
});
it("fails closed on projection read failure rather than returning raw data or directory fallback", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await pg.exec("drop view mn_public.artists");
    const response = await getArtistBioHandler(new Request("https://test.invalid/read"), artist);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Unable to read About. Please try again.",
    });
    const lookup = await findArtistHandler(
      new Request("https://test.invalid/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotify: "synthetic" }),
      }),
      "spotify",
      lookupArtists.spotify,
      "Missing spotify",
    );
    expect(lookup.status).toBe(500);
    await expect(toArtistDetail(rawArtist as ArtistRow)).rejects.toThrow();
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(mocks.forbidden).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

it("rechecks exact legacy allowance on every public handler read without exposing allowance metadata", async () => {
  await pg.exec("delete from mn_private.artist_bio_provenance");
  await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
  await pg.query("insert into mn_private.legacy_bio_publications values($1,$2,$3)", [
    artist,
    claim,
    createHash("sha256").update("Public biography").digest("hex"),
  ]);
  await checkResponses("Public biography");
  await pg.exec("delete from mn_private.legacy_bio_publications");
  await checkResponses(null);
});
