/** TEST-ONLY receipt decorator around the real writer. No HTTP/auth/provider or deployment proof. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns, sql } from "drizzle-orm";
import { rowsOf } from "../../../lib/db/rowsOf";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "../../../lib/db/schema";
import { vaultSourceRevision } from "../../../lib/lore/vaultSourceRevision";
import { prepareUrlReceipt, type ReceiptTransaction } from "./prepareUrlReceipt";
import type { writeBioProvenance } from "../../../lib/bio/writeBioProvenance";
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
vi.mock("@/lib/bio/writeBioProvenance", async importOriginal => {
  const actual = await importOriginal<typeof import("../../../lib/bio/writeBioProvenance")>();
  return {
    writeBioProvenance: async (...args: Parameters<typeof writeBioProvenance>) => {
      const [tx, , provenance] = args;
      const adapter: ReceiptTransaction = {
        query: async <T>(statement: string, params: unknown[]) => {
          // Only static SQL supplied by prepareUrlReceipt. Values remain bound SQL parameters.
          const chunks = statement.split(/(\$\d+)/).map(part => {
            if (!/^\$\d+$/.test(part)) return sql.raw(part);
            const index = Number(part.slice(1)) - 1;
            if (index < 0 || index >= params.length) throw new Error("Invalid receipt parameter");
            return sql`${params[index]}`;
          });
          const result = await tx.execute(sql.join(chunks, sql.raw("")));
          return { rows: rowsOf(result) as T[] };
        },
      };
      if (
        provenance &&
        typeof provenance === "object" &&
        "sources" in provenance &&
        Array.isArray(provenance.sources)
      ) {
        for (const source of provenance.sources) {
          // Policy rejection hides public output; it must not block preserving/editing old lineage.
          // Storage and receipt-conflict exceptions still abort the publication transaction.
          if (source && typeof source.url === "string")
            await prepareUrlReceipt(adapter, source.url);
        }
      }
      await actual.writeBioProvenance(...args);
    },
  };
});
const { persistArtistBio } = await import("../../../lib/bio/persistArtistBio");
const { getPublicSavedBio } = await import("../../../lib/bio/getPublicSavedBio");
const migration = readFileSync(new URL("./projection.sql", import.meta.url), "utf8");
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
      await expect(attempt).rejects.toMatchObject({
        cause: { message: "Synthetic receipt storage failure" },
      });
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
