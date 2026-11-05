import { readFileSync } from "node:fs";
/** Disposable, provider-free generation workflow. One synthetic artist reset per case; not staging E2E. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "../../../lib/db/schema";
const mocks = vi.hoisted(() => ({
  lore: vi.fn(),
  about: vi.fn(),
  summary: vi.fn(),
  network: vi.fn(() => {
    throw new Error("Network forbidden in synthetic harness");
  }),
}));
let pg: PGlite;
let database: ReturnType<typeof drizzle<typeof schema>>;
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
// Mock only model-facing generation and unused social channels; vault gathering/eligibility is real.
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({ synthesizeArtistDoc: mocks.lore }));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({ generateAboutFromDoc: mocks.about }));
vi.mock("@/lib/lore/generateLoreSummary", () => ({ generateLoreSummary: mocks.summary }));
vi.mock("@/lib/instagram/getSocialPostsOrNull", () => ({ getSocialPostsOrNull: async () => [] }));
vi.mock("@/lib/lore/captionCreditSources", () => ({
  captionCreditSources: async () => ({
    creditedCollaborators: [],
    selfCredits: [],
    artistStatements: [],
  }),
}));
const { generateArtistBio } = await import("../../../lib/bio/generateArtistBio");
const { gatherDocMaterial } = await import("../../../lib/lore/gatherDocMaterial");
const { toSourceList } = await import("../../../lib/lore/toSourceList");
const { getPublicSavedBio } = await import("../../../lib/bio/getPublicSavedBio");
const artist = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const source = "00000000-0000-4000-8000-000000000003";
const auth = { userId: user, expectedClaimId: null };
const tables = {
  artists: schema.artists,
  users: schema.users,
  artist_claims: schema.artistClaims,
  artist_bio_versions: schema.artistBioVersions,
  artist_docs: schema.artistDocs,
  artist_onboarding_steps: schema.artistOnboardingSteps,
  artist_vault_sources: schema.artistVaultSources,
  artist_activity_events: schema.artistActivityEvents,
  artist_research_jobs: schema.artistResearchJobs,
  artist_interview_answers: schema.artistInterviewAnswers,
};
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.network);
  pg = new PGlite();
  database = drizzle(pg, { schema });
  for (const [name, table] of Object.entries(tables)) {
    const columns = Object.values(getTableColumns(table))
      .map(c => {
        const type = "enumValues" in c && Array.isArray(c.enumValues) ? "text" : c.getSQLType();
        const def =
          c.name === "id"
            ? " default gen_random_uuid()"
            : ["created_at", "updated_at"].includes(c.name)
              ? " default now()"
              : c.name === "attempts"
                ? " default 0"
                : "";
        return `"${c.name}" ${type}${def}`;
      })
      .join(",");
    await pg.exec(`create table ${name}(${columns})`);
  }
  await pg.exec(
    "create schema mn_private;create table mn_private.legacy_bio_publications(artist_id uuid primary key,claim_id uuid not null,bio_hash text not null);create table mn_private.public_url_receipts(url_hash bytea,url text,policy_version integer,primary key(url_hash,policy_version));create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb not null);create table mn_private.artist_bio_version_provenance(version_id uuid primary key,provenance jsonb not null);alter table artist_docs add unique(artist_id);alter table artist_onboarding_steps add unique(artist_id,step);create unique index active_job on artist_research_jobs(artist_id,kind) where status in ('pending','running')",
  );
  await pg.exec("create role mnweb;create role anon;create role authenticated;");
  await pg.exec(
    readFileSync(
      new URL("../pg17-ci/fixtures/0064_lore_activity_lock.sql", import.meta.url),
      "utf8",
    ),
  );
  await pg.query(
    "insert into artists(id,name,bio) values($1,'Synthetic artist','Original About')",
    [artist],
  );
  await pg.query("insert into users(id,is_admin) values($1,true)", [user]);
  await pg.query(
    "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'submission','public','approved','https://example.org/synthetic',$3)",
    [source, artist, "Synthetic verified evidence. ".repeat(30)],
  );
  mocks.lore.mockImplementation(async () => ({
    doc: "Synthetic Lore [1]",
    sources: toSourceList(await gatherDocMaterial(artist)),
  }));
  mocks.about.mockResolvedValue("Generated About [1]");
  mocks.summary.mockResolvedValue(null);
});
afterEach(async () => {
  try {
    expect(mocks.network).not.toHaveBeenCalled();
  } finally {
    try {
      await pg?.close();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  }
});
async function readState() {
  return {
    artists: (await pg.query("select bio from artists")).rows,
    docs: (await pg.query("select content,sources from artist_docs")).rows,
    jobs: (await pg.query("select kind,status,claimed_at,attempts from artist_research_jobs")).rows,
    history: (await pg.query("select bio_text from artist_bio_versions order by bio_text")).rows,
  };
}
async function expectPreserved() {
  expect((await readState()).artists).toEqual([{ bio: "Original About" }]);
  expect((await readState()).history).toEqual([]);
  expect((await pg.query("select * from mn_private.artist_bio_provenance")).rows).toEqual([]);
}
it("prepares missing Lore from eligible stored sources and commits About/history/provenance without research fanout", async () => {
  expect((await readState()).docs).toEqual([]);
  expect(await generateArtistBio(artist, auth)).toEqual({
    httpStatus: 200,
    bio: "Generated About",
  });
  const state = await readState();
  expect(state.docs).toMatchObject([
    {
      content: "Synthetic Lore [1]",
      sources: [{ kind: "vault", url: "https://example.org/synthetic" }],
    },
  ]);
  expect(state.jobs).toEqual([
    { kind: "lore_refresh", status: "done", claimed_at: null, attempts: 0 },
  ]);
  expect(state.history).toEqual([{ bio_text: "Generated About" }, { bio_text: "Original About" }]);
  expect(await getPublicSavedBio(artist)).toBe("Generated About");
  expect(mocks.lore).toHaveBeenCalledTimes(1);
  expect(mocks.summary).toHaveBeenCalledTimes(1);
  expect(mocks.about).toHaveBeenCalledTimes(1);
});
it("reuses an existing current document without rebuilding Lore", async () => {
  const sources = toSourceList(await gatherDocMaterial(artist));
  await pg.query(
    "insert into artist_docs(artist_id,content,sources) values($1,'Existing Lore',$2)",
    [artist, JSON.stringify(sources)],
  );
  expect(await generateArtistBio(artist, auth)).toEqual({
    httpStatus: 200,
    bio: "Generated About",
  });
  expect(mocks.lore).not.toHaveBeenCalled();
  expect(mocks.summary).not.toHaveBeenCalled();
  expect(mocks.about).toHaveBeenCalledWith(
    "Synthetic artist",
    "Existing Lore",
    sources,
    expect.any(Object),
  );
  expect((await readState()).docs).toEqual([{ content: "Existing Lore", sources }]);
});
it("reports unreadable Lore without generating or losing existing About", async () => {
  await pg.exec("update artist_vault_sources set extracted_text=null");
  expect(await generateArtistBio(artist, auth)).toMatchObject({
    httpStatus: 409,
    code: "LORE_REQUIRED",
  });
  await expectPreserved();
  expect(mocks.lore).not.toHaveBeenCalled();
  expect(mocks.about).not.toHaveBeenCalled();
  expect((await readState()).jobs).toMatchObject([{ status: "done", claimed_at: null }]);
});
it("distinguishes prerequisite failure, releases lease for retry and preserves About", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.lore.mockRejectedValue(new Error("Synthetic Lore generation failure"));
  expect(await generateArtistBio(artist, auth)).toMatchObject({
    httpStatus: 500,
    code: "LORE_PREPARATION_FAILED",
  });
  await expectPreserved();
  expect(mocks.about).not.toHaveBeenCalled();
  expect((await readState()).docs).toEqual([]);
  expect((await readState()).jobs).toMatchObject([
    { status: "pending", claimed_at: null, attempts: 1 },
  ]);
});
it("retains successfully prepared Lore but preserves About when About generation fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.about.mockRejectedValue(new Error("Synthetic About generation failure"));
  expect(await generateArtistBio(artist, auth)).toMatchObject({
    httpStatus: 500,
    error: "Could not generate About from Lore. Your existing About has been kept.",
  });
  await expectPreserved();
  expect((await readState()).docs).toMatchObject([{ content: "Synthetic Lore [1]" }]);
  expect((await readState()).jobs).toMatchObject([{ status: "done", claimed_at: null }]);
});
it("returns busy for a live lease without invoking a model or taking another job", async () => {
  await pg.query(
    "insert into artist_research_jobs(artist_id,kind,status,claimed_at,state) values($1,'lore_refresh','running',now(),'{\"claimId\":null}')",
    [artist],
  );
  expect(await generateArtistBio(artist, auth)).toMatchObject({
    httpStatus: 409,
    code: "LORE_PREPARING",
  });
  await expectPreserved();
  expect((await readState()).jobs).toHaveLength(1);
  expect(mocks.lore).not.toHaveBeenCalled();
  expect(mocks.about).not.toHaveBeenCalled();
});
it("refuses an unclaimed artist edit by a non-admin through real database authorization", async () => {
  await pg.exec("update users set is_admin=false");
  expect(await generateArtistBio(artist, auth)).toMatchObject({ httpStatus: 409 });
  await expectPreserved();
  expect((await readState()).jobs).toEqual([]);
  expect(mocks.lore).not.toHaveBeenCalled();
});
it("rejects source withdrawal during About generation and releases its exact lease", async () => {
  mocks.about.mockImplementation(async () => {
    await pg.exec("update artist_vault_sources set publication='private'");
    return "Must not publish";
  });
  expect(await generateArtistBio(artist, auth)).toMatchObject({ httpStatus: 409 });
  await expectPreserved();
  expect((await readState()).jobs).toMatchObject([{ status: "done", claimed_at: null }]);
  expect(await getPublicSavedBio(artist)).toBeNull();
});

it("rebuilds an existing document when newly eligible Lore changes its complete manifest", async () => {
  const oldSources = toSourceList(await gatherDocMaterial(artist));
  await pg.query("insert into artist_docs(artist_id,content,sources) values($1,'Stale Lore',$2)", [
    artist,
    JSON.stringify(oldSources),
  ]);
  await pg.query(
    "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values(gen_random_uuid(),$1,'submission','public','approved','https://example.org/new-synthetic',$2)",
    [artist, "New synthetic verified evidence. ".repeat(30)],
  );
  expect(await generateArtistBio(artist, auth)).toEqual({
    httpStatus: 200,
    bio: "Generated About",
  });
  expect(mocks.lore).toHaveBeenCalledTimes(1);
  const doc = (
    await pg.query<{ content: string; sources: unknown[] }>(
      "select content,sources from artist_docs",
    )
  ).rows[0];
  expect(doc.content).toBe("Synthetic Lore [1]");
  expect(doc.sources).toHaveLength(2);
  expect(await getPublicSavedBio(artist)).toBe("Generated About");
});

it("rejects a second request while the first is paused in model work, then settles the first lease", async () => {
  // App orchestration only: PGlite is single-connection, not a database-lock concurrency proof.
  let reached!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolve => {
    reached = resolve;
  });
  const hold = new Promise<void>(resolve => {
    release = resolve;
  });
  mocks.about.mockImplementation(async () => {
    reached();
    await hold;
    return "First request About";
  });
  const first = generateArtistBio(artist, auth);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      entered,
      first.then(() => {
        throw new Error("First request completed before model barrier");
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Model barrier timeout")), 2000);
      }),
    ]);
    expect(await generateArtistBio(artist, auth)).toMatchObject({
      httpStatus: 409,
      code: "LORE_PREPARING",
    });
    expect((await readState()).jobs).toHaveLength(1);
    expect(mocks.lore).toHaveBeenCalledTimes(1);
    expect(mocks.about).toHaveBeenCalledTimes(1);
  } finally {
    clearTimeout(timeout);
    release();
    await first;
  }
  expect(await first).toEqual({ httpStatus: 200, bio: "First request About" });
  expect((await readState()).jobs).toMatchObject([{ status: "done", claimed_at: null }]);
  expect(await getPublicSavedBio(artist)).toBe("First request About");
});

it("allows the approved claimant without admin authority through the real write gate", async () => {
  const claim = "00000000-0000-4000-8000-000000000004";
  await pg.exec("update users set is_admin=false");
  await pg.query(
    "insert into artist_claims(id,artist_id,user_id,status) values($1,$2,$3,'approved')",
    [claim, artist, user],
  );
  expect(await generateArtistBio(artist, { userId: user, expectedClaimId: claim })).toEqual({
    httpStatus: 200,
    bio: "Generated About",
  });
  expect(
    (
      await pg.query<{ provenance: { claimId: string } }>(
        "select provenance from mn_private.artist_bio_provenance",
      )
    ).rows[0].provenance.claimId,
  ).toBe(claim);
  expect(await getPublicSavedBio(artist)).toBe("Generated About");
  expect((await readState()).jobs).toMatchObject([{ status: "done", claimed_at: null }]);
});
