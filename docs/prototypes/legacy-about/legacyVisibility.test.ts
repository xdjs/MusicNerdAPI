import { projectSavedPublicBio as apiBaseline } from "./fixtures/apiProjectSavedPublicBio";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { projectSavedPublicBio } from "../../../lib/bio/projectSavedPublicBio";
import { nextBioProvenance } from "../../../lib/bio/nextBioProvenance";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
import { prepareUrlReceipt } from "../guarded-about/prepareUrlReceipt";
import { projectSavedPublicBio as webProjector } from "./fixtures/webProjectSavedPublicBio";
import { projectEvidenceBackedBio } from "./projectEvidenceBackedBio";
import { buildEvidenceBackedSql } from "./buildEvidenceBackedSql";
const artist = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const claim = "00000000-0000-4000-8000-000000000003";
const bio = "Preserved biography bytes.";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const source = {
  id: sourceId,
  url: "https://example.org/evidence",
  activityId: null,
  origin: "submission",
  publication: "public",
  extractedText: "Synthetic evidence",
};
const lineage = (
  kind: "generated" | "authored",
  sources: unknown[] = [],
  claimId: string | null = claim,
) => ({ version: 1, kind, bioHash: hash(bio), claimId, sources });
const vault = { id: 1, kind: "vault", url: source.url, revision: vaultSourceRevision(source) };
let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create role mnweb;
    create schema mn_private;revoke all on schema mn_private from public;grant usage on schema mn_private to mnweb;
    create table artists(id uuid primary key,name text,bio text);
    create table artist_claims(id uuid,artist_id uuid,status text);
    create table artist_vault_sources(id uuid,artist_id uuid,activity_id uuid,origin text,publication text,status text,url text,extracted_text text,title text,snippet text,published_at date,file_path text);
    create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,actor_user_id uuid,trigger text,action text);
    create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb not null);
    create table artist_bio_versions(id uuid,bio_text text,is_pinned boolean);
    grant usage on schema public to public;grant select on artists to anon,authenticated;
    grant select on artists,artist_claims,artist_vault_sources,artist_activity_events,mn_private.artist_bio_provenance to mnweb;`);
  const base = readFileSync(new URL("../guarded-about/projection.sql", import.meta.url), "utf8");
  await pg.exec(buildEvidenceBackedSql(base));
  await prepareUrlReceipt(pg, source.url);
});
beforeEach(async () => {
  await pg.exec(
    "truncate artists,artist_claims,artist_vault_sources,artist_activity_events,mn_private.artist_bio_provenance,artist_bio_versions",
  );
  await pg.query("insert into artists values($1,'Synthetic artist',$2)", [artist, bio]);
  await pg.query("insert into artist_bio_versions values($1,$2,true)", [artist, bio]);
});
afterAll(async () => {
  await pg?.close();
});
async function visible() {
  await pg.exec("set role anon");
  try {
    return (await pg.query<{ bio: string | null }>("select bio from mn_public.artists")).rows[0]
      .bio;
  } finally {
    await pg.exec("reset role");
  }
}
const cases = [
  {
    name: "claimed legacy with no source records",
    p: null,
    currentClaim: claim,
    baseline: bio,
    expected: null,
  },
  { name: "unclaimed legacy", p: null, currentClaim: null, baseline: null, expected: null },
  {
    name: "explicit unknown provenance",
    p: { version: 1, kind: "unknown", bioHash: hash(bio) },
    currentClaim: claim,
    baseline: null,
    expected: null,
  },
  {
    name: "claimed generated empty manifest",
    p: lineage("generated"),
    currentClaim: claim,
    baseline: bio,
    expected: null,
  },
  {
    name: "unclaimed generated empty manifest",
    p: lineage("generated", [], null),
    currentClaim: null,
    baseline: null,
    expected: null,
  },
  {
    name: "explicit authored empty manifest",
    p: lineage("authored"),
    currentClaim: claim,
    baseline: bio,
    expected: bio,
  },
  {
    name: "authored wrong claim",
    p: lineage("authored", [], "old-claim"),
    currentClaim: claim,
    baseline: null,
    expected: null,
  },
  {
    name: "authored wrong hash",
    p: { ...lineage("authored"), bioHash: hash("Other text") },
    currentClaim: claim,
    baseline: null,
    expected: null,
  },
  {
    name: "authored missing claim scope",
    p: lineage("authored", [], null),
    currentClaim: claim,
    baseline: null,
    expected: null,
  },
  {
    name: "generated missing sources field",
    p: { version: 1, kind: "generated", claimId: claim, bioHash: hash(bio) },
    currentClaim: claim,
    baseline: null,
    expected: null,
  },
  {
    name: "legacy with newly added unrelated evidence",
    p: null,
    currentClaim: claim,
    baseline: bio,
    expected: null,
    evidence: true,
  },
  {
    name: "generated current vault evidence",
    p: lineage("generated", [vault]),
    currentClaim: claim,
    baseline: bio,
    expected: bio,
    evidence: true,
  },
  {
    name: "generated withdrawn vault evidence",
    p: lineage("generated", [vault]),
    currentClaim: claim,
    baseline: null,
    expected: null,
  },
];
it.each(cases)("matches API/Web/SQL candidate: $name", async test => {
  if (test.currentClaim)
    await pg.query("insert into artist_claims values($1,$2,'approved')", [
      test.currentClaim,
      artist,
    ]);
  if (test.p !== null)
    await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
      artist,
      JSON.stringify(test.p),
    ]);
  if (test.evidence)
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'submission','public','approved',$3,$4)",
      [sourceId, artist, source.url, source.extractedText],
    );
  const row = {
    bio,
    provenance: test.p,
    claimId: test.currentClaim,
    evidence: test.evidence ? [source] : [],
  };
  expect(apiBaseline(row)).toBe(test.baseline);
  expect(projectSavedPublicBio(row)).toBe(test.expected);
  expect(webProjector(row)).toBe(test.baseline);
  expect(projectEvidenceBackedBio(row)).toBe(test.expected);
  expect(projectEvidenceBackedBio(row, webProjector)).toBe(test.expected);
  expect(await visible()).toBe(test.expected);
  // Candidate only reads; raw owner/editor bytes and pinned history are retained verbatim.
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio }]);
  expect((await pg.query("select bio_text,is_pinned from artist_bio_versions")).rows).toEqual([
    { bio_text: bio, is_pinned: true },
  ]);
});
it("does not turn a legacy edit or a pin into authored lineage", () => {
  const edited = "Manual edited bytes";
  expect(nextBioProvenance(edited, bio, null)).toBeNull();
  expect(
    projectEvidenceBackedBio({
      bio: edited,
      provenance: nextBioProvenance(edited, bio, null),
      claimId: claim,
      evidence: [],
    }),
  ).toBeNull();
  expect(
    projectEvidenceBackedBio({ bio, provenance: null, claimId: claim, evidence: [] }),
  ).toBeNull();
});
it("refuses an unexpected SQL template instead of partially changing policy", () => {
  expect(() => buildEvidenceBackedSql("select 1")).toThrow("candidate policy needs review");
});
