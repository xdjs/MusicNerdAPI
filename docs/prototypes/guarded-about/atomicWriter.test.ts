import { useExistingUrlReceipts } from "./useExistingUrlReceipts";
/** Real receipt preparation in the actual writer on a synthetic database. No HTTP/auth/provider or deployment proof. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "../../../lib/db/schema";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
let pg: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
// This test does not prove request authorization; automatic ownership claim lookup remains real.
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: () => {
    throw new Error("Unexpected user authorization path");
  },
}));
const { persistArtistBio } = await import("../../../lib/bio/persistArtistBio");
const { getPublicSavedBio } = await import("../../../lib/bio/getPublicSavedBio");
const migration = useExistingUrlReceipts(
  readFileSync(new URL("./projection.sql", import.meta.url), "utf8"),
);
const legacyMigration = readFileSync(
  new URL("./fixtures/0063_legacy_bio_publications.sql", import.meta.url),
  "utf8",
);
const receiptMigration = readFileSync(
  new URL("./fixtures/0062_public_url_receipts.sql", import.meta.url),
  "utf8",
);
const artist = "00000000-0000-4000-8000-000000000001";
const sourceId = "00000000-0000-4000-8000-000000000002";
const job = "00000000-0000-4000-8000-000000000003";
const source = {
  id: sourceId,
  activityId: null,
  origin: "upload",
  publication: "public",
  url: "https://example.org/evidence?ref=O'Reilly",
  extractedText: "Verified synthetic evidence. ".repeat(30),
};
const sources = () => [
  { id: 1, kind: "vault" as const, url: source.url, revision: vaultSourceRevision(source) },
];
const lease = { jobId: job, claimedAt: "2026-11-03T00:00:00.000Z", requestedAt: "synthetic" };
const options = () => ({
  ownership: { expectedClaimId: null },
  generated: true,
  expectedBio: "Original manual",
  documentOrigin: "server" as const,
  document: { content: "New Lore", sources: sources() },
  aboutLease: lease,
});
beforeEach(async () => {
  pg = new PGlite();
  database = drizzle(pg, { schema });
  await pg.exec(
    "create role anon;create role authenticated;create role mnweb;create schema mn_private;revoke all on schema mn_private from public;grant usage on schema mn_private to mnweb",
  );
  for (const [name, table] of Object.entries({
    artists: schema.artists,
    artist_bio_versions: schema.artistBioVersions,
    artist_docs: schema.artistDocs,
    artist_onboarding_steps: schema.artistOnboardingSteps,
    artist_vault_sources: schema.artistVaultSources,
    artist_activity_events: schema.artistActivityEvents,
    artist_research_jobs: schema.artistResearchJobs,
  })) {
    const columns = Object.values(getTableColumns(table))
      .map(
        c =>
          `"${c.name}" ${"enumValues" in c && Array.isArray(c.enumValues) ? "text" : c.getSQLType()}${c.name === "id" ? " default gen_random_uuid()" : ""}`,
      )
      .join(",");
    await pg.exec(`create table ${name}(${columns})`);
  }
  await pg.exec(
    "create table artist_claims(id uuid,user_id uuid,artist_id uuid,status text);create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb not null);create table mn_private.artist_bio_version_provenance(version_id uuid primary key,provenance jsonb not null);alter table artist_docs add unique(artist_id);grant usage on schema public to public;grant select on artists to anon,authenticated;grant all on all tables in schema public to mnweb;grant all on all tables in schema mn_private to mnweb;alter table artists enable row level security;create policy public_read on artists for select to public using(true)",
  );
  for (const table of [
    "artists",
    "artist_claims",
    "artist_vault_sources",
    "artist_activity_events",
    "mn_private.artist_bio_provenance",
  ])
    await pg.exec(
      `alter table ${table} enable row level security;create policy app on ${table} to mnweb using(true) with check(true)`,
    );
  // Exact reviewed Web 0062 fixture; independent of another checkout or credentials.
  expect(createHash("sha256").update(receiptMigration).digest("hex")).toBe(
    "d93d34e56aed271bf1fc83f1616195a0964ebecb0530a8ed566d7c6189a2752c",
  );
  await pg.exec(receiptMigration);
  await pg.exec(
    "alter table artists add primary key(id);alter table artist_claims add primary key(id)",
  );
  await pg.exec(legacyMigration);
  await pg.exec(
    readFileSync(
      new URL("../pg17-ci/fixtures/0064_lore_activity_lock.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.exec("revoke update,delete on artist_activity_events from mnweb");
  await pg.query(
    "insert into artists(id,name,bio) values($1,'Synthetic artist','Original manual')",
    [artist],
  );
  await pg.query(
    "insert into artist_docs(artist_id,content,sources) values($1,'Original Lore','[]')",
    [artist],
  );
  await pg.query(
    "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'upload','public','approved',$3,$4)",
    [sourceId, artist, source.url, source.extractedText],
  );
  await pg.query(
    "insert into artist_research_jobs(id,artist_id,kind,status,claimed_at,state,attempts) values($1,$2,'lore_refresh','running',$3,'{\"requestedAt\":\"synthetic\"}',0)",
    [job, artist, lease.claimedAt],
  );
});
afterEach(async () => {
  await pg.close();
});
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of [
    "artists",
    "artist_docs",
    "artist_bio_versions",
    "mn_private.artist_bio_provenance",
    "mn_private.artist_bio_version_provenance",
    "mn_private.public_url_receipts",
    "mn_private.legacy_bio_publications",
    "artist_research_jobs",
    "artist_activity_events",
  ])
    result[table] = (await pg.query(`select * from ${table}`)).rows;
  return result;
}
async function visible() {
  await pg.exec("set role anon");
  try {
    return (await pg.query("select bio from mn_public.artists")).rows;
  } finally {
    await pg.exec("reset role");
  }
}
it("publishes real About, Lore, history, lineage, receipt and lease settlement atomically; withdrawal hides both public reads", async () => {
  await pg.exec(migration);
  await expect(persistArtistBio(artist, "Generated About", options())).resolves.toBe(
    "Generated About",
  );
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Generated About" }]);
  expect((await pg.query("select content,sources from artist_docs")).rows).toEqual([
    { content: "New Lore", sources: sources() },
  ]);
  expect(
    (await pg.query("select bio_text from artist_bio_versions order by bio_text")).rows,
  ).toEqual([{ bio_text: "Generated About" }, { bio_text: "Original manual" }]);
  const current = (
    await pg.query<{ provenance: unknown }>(
      "select provenance from mn_private.artist_bio_provenance",
    )
  ).rows[0].provenance;
  expect(current).toMatchObject({ kind: "generated", claimId: null, sources: sources() });
  expect(
    (await pg.query("select provenance from mn_private.artist_bio_version_provenance")).rows,
  ).toEqual([{ provenance: current }]);
  expect(
    (await pg.query("select url,policy_version from mn_private.public_url_receipts")).rows,
  ).toEqual([{ url: source.url, policy_version: 1 }]);
  expect((await pg.query("select status,claimed_at from artist_research_jobs")).rows).toEqual([
    { status: "done", claimed_at: null },
  ]);
  expect(await visible()).toEqual([{ bio: "Generated About" }]);
  expect(await getPublicSavedBio(artist)).toBe("Generated About");
  await pg.exec("update artist_vault_sources set publication='private'");
  expect(await visible()).toEqual([{ bio: null }]);
  expect(await getPublicSavedBio(artist)).toBeNull();
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Generated About" }]);
});
it.each(["storage", "conflict"])(
  "rolls every real publication write and lease settlement back on receipt %s failure",
  async failure => {
    await pg.exec(migration);
    if (failure === "storage")
      await pg.exec(
        "create function deny_receipt() returns trigger language plpgsql as $$begin raise exception 'Synthetic receipt storage failure';end$$;create trigger deny_receipt before insert on mn_private.public_url_receipts for each row execute function deny_receipt()",
      );
    else
      await pg.query(
        "insert into mn_private.public_url_receipts values(decode($1,'hex'),'https://example.org/conflicting',1)",
        [createHash("sha256").update(source.url).digest("hex")],
      );
    const before = await snapshot();
    const attempt = persistArtistBio(artist, "Must roll back", options());
    if (failure === "storage")
      await expect(attempt).rejects.toThrow("Could not prepare About URL receipts");
    else
      await expect(attempt).rejects.toThrow("URL receipt conflict: exact bytes were not persisted");
    expect(await snapshot()).toEqual(before);
  },
);
it("refuses unknown raw-reader cutover without silently revoking its existing access", async () => {
  await pg.exec("create role unknown_external login;grant select on artists to unknown_external");
  await pg.exec("begin");
  await expect(pg.exec(migration)).rejects.toThrow("Unexpected public raw access");
  await pg.exec("rollback;set role unknown_external");
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Original manual" }]);
  await pg.exec("reset role");
  expect((await pg.query("select to_regclass('mn_public.artists') as view")).rows).toEqual([
    { view: null },
  ]);
});

it("preserves a real manual edit with policy-rejected historical URLs while both public readers hide it", async () => {
  await pg.exec(migration);
  const url = "https://example.org/evidence?token=synthetic-secret";
  await pg.query("update artist_vault_sources set url=$1", [url]);
  const lineage = {
    version: 1,
    kind: "generated",
    claimId: null,
    bioHash: createHash("sha256").update("Original manual").digest("hex"),
    sources: [{ id: 1, kind: "vault", url, revision: vaultSourceRevision({ ...source, url }) }],
  };
  await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
    artist,
    JSON.stringify(lineage),
  ]);
  await expect(
    persistArtistBio(artist, "Manual edit retained", { ownership: { expectedClaimId: null } }),
  ).resolves.toBe("Manual edit retained");
  const edited = {
    ...lineage,
    bioHash: createHash("sha256").update("Manual edit retained").digest("hex"),
  };
  expect((await pg.query("select bio from artists")).rows).toEqual([
    { bio: "Manual edit retained" },
  ]);
  expect((await pg.query("select provenance from mn_private.artist_bio_provenance")).rows).toEqual([
    { provenance: edited },
  ]);
  expect(
    (
      await pg.query(
        "select v.bio_text,p.provenance from artist_bio_versions v join mn_private.artist_bio_version_provenance p on p.version_id=v.id order by v.bio_text",
      )
    ).rows,
  ).toEqual([
    { bio_text: "Manual edit retained", provenance: edited },
    { bio_text: "Original manual", provenance: lineage },
  ]);
  expect((await pg.query("select * from mn_private.public_url_receipts")).rows).toEqual([]);
  expect((await pg.query("select content from artist_docs")).rows).toEqual([
    { content: "Original Lore" },
  ]);
  expect(await visible()).toEqual([{ bio: null }]);
  expect(await getPublicSavedBio(artist)).toBeNull();
});

it.each([
  "alter table mn_private.public_url_receipts disable row level security",
  "grant select on mn_private.public_url_receipts to anon",
  "drop policy mnweb_public_url_receipts_select on mn_private.public_url_receipts",
  "alter table mn_private.public_url_receipts drop constraint public_url_receipts_hash_length",
])("refuses drift in existing0062 receipts: %s", async change => {
  await pg.exec(change);
  await pg.exec("begin");
  await expect(pg.exec(migration)).rejects.toThrow(/Existing receipt/);
  await pg.exec("rollback");
  expect((await pg.query("select to_regclass('mn_public.artists') as view")).rows).toEqual([
    { view: null },
  ]);
});

const legacyClaim = "00000000-0000-4000-8000-000000000004";
async function seedLegacyAllowance() {
  await pg.query("insert into artist_claims(id,artist_id,status) values($1,$2,'approved')", [
    legacyClaim,
    artist,
  ]);
  await pg.query("insert into mn_private.legacy_bio_publications values($1,$2,$3)", [
    artist,
    legacyClaim,
    createHash("sha256").update("Original manual").digest("hex"),
  ]);
}
async function expectLegacyHidden() {
  expect(await getPublicSavedBio(artist)).toBeNull();
  expect(await visible()).toEqual([{ bio: null }]);
}
it("preserves only the explicitly allowed exact legacy snapshot in API and SQL reads", async () => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  expect(await getPublicSavedBio(artist)).toBe("Original manual");
  expect(await visible()).toEqual([{ bio: "Original manual" }]);
  await pg.exec("set role mnweb");
  await expect(pg.query("delete from mn_private.legacy_bio_publications")).rejects.toMatchObject({
    code: "42501",
  });
  await pg.exec("reset role");
});
it.each([
  { kind: "unknown" },
  { version: 1, kind: "generated", sources: [] },
  { kind: ["generated"] },
  null,
])("never uses allowance as fallback for known or malformed lineage %j", async lineage => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
    artist,
    JSON.stringify(lineage),
  ]);
  expect((await pg.query("select * from mn_private.legacy_bio_publications")).rows).toEqual([]);
  // Even an erroneous owner reseed must not bypass known lineage, including JSON null.
  await pg.query("insert into mn_private.legacy_bio_publications values($1,$2,$3)", [
    artist,
    legacyClaim,
    createHash("sha256").update("Original manual").digest("hex"),
  ]);
  await expectLegacyHidden();
});
it.each(["status='revoked'", "user_id='00000000-0000-4000-8000-000000000009'"])(
  "consumes allowance permanently across claim change/reapproval: %s",
  async change => {
    await seedLegacyAllowance();
    await pg.exec(migration);
    await pg.exec(`update artist_claims set ${change}`);
    await pg.exec("update artist_claims set status='approved',user_id=null");
    await expectLegacyHidden();
    expect((await pg.query("select * from mn_private.legacy_bio_publications")).rows).toEqual([]);
  },
);
it("claim deletion and recreation cannot restore the old allowance", async () => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await pg.exec("delete from artist_claims");
  await pg.query("insert into artist_claims(id,artist_id,status) values($1,$2,'approved')", [
    legacyClaim,
    artist,
  ]);
  await expectLegacyHidden();
});
it("editing and restoring pinned historical bytes never revives consumed legacy publication", async () => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await pg.query(
    "insert into artist_bio_versions(artist_id,bio_text,is_pinned) values($1,'Original manual',true)",
    [artist],
  );
  await pg.exec("update artists set bio='Edited';update artists set bio='Original manual'");
  await expectLegacyHidden();
  expect((await pg.query("select bio_text,is_pinned from artist_bio_versions")).rows).toEqual([
    { bio_text: "Original manual", is_pinned: true },
  ]);
});
it.each([
  "update artist_vault_sources set status='rejected'",
  "update artist_vault_sources set publication='private'",
  "delete from artist_vault_sources",
])("consumes allowance when formerly eligible evidence is withdrawn: %s", async change => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await pg.exec(change);
  await expectLegacyHidden();
});
it("rejecting a newly pending unrelated source does not consume the existing allowance", async () => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await pg.query(
    "insert into artist_vault_sources(artist_id,status,publication,url) values($1,'pending','public','https://example.org/unrelated')",
    [artist],
  );
  await pg.exec("update artist_vault_sources set status='rejected' where status='pending'");
  expect(await getPublicSavedBio(artist)).toBe("Original manual");
});
it("same-text generation consumes allowance; deleting lineage cannot revive legacy fallback", async () => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await persistArtistBio(artist, "Original manual", {
    ...options(),
    ownership: { expectedClaimId: legacyClaim },
  });
  expect((await pg.query("select * from mn_private.legacy_bio_publications")).rows).toEqual([]);
  expect(await getPublicSavedBio(artist)).toBe("Original manual");
  await pg.exec("delete from mn_private.artist_bio_provenance");
  await expectLegacyHidden();
});
it("failed generation publication rolls back allowance consumption and retains old public bytes", async () => {
  await seedLegacyAllowance();
  await pg.exec(migration);
  await pg.exec(
    "create function fail_new_provenance() returns trigger language plpgsql as $$begin raise exception 'Synthetic write failed';end$$;create trigger fail_new_provenance after insert on mn_private.artist_bio_provenance for each row execute function fail_new_provenance()",
  );
  await expect(
    persistArtistBio(artist, "New generated", {
      ...options(),
      ownership: { expectedClaimId: legacyClaim },
    }),
  ).rejects.toThrow();
  expect(await getPublicSavedBio(artist)).toBe("Original manual");
  expect(await visible()).toEqual([{ bio: "Original manual" }]);
  expect((await pg.query("select content from artist_docs")).rows).toEqual([
    { content: "Original Lore" },
  ]);
  expect((await pg.query("select * from artist_bio_versions")).rows).toEqual([]);
});
