/** Calls real Next route exports in-process; not a Next server or deployed auth test. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "../../../../lib/db/schema";
import { createHostedAboutAdapter } from "../createHostedAboutAdapter";
import { denyProvider } from "../denyProvider";
let adapter: ReturnType<typeof createHostedAboutAdapter>;
const mocks = vi.hoisted(() => ({
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
vi.mock("@/lib/lore/synthesizeArtistDoc", () => ({
  synthesizeArtistDoc: (...args: Parameters<typeof adapter.synthesizeArtistDoc>) =>
    adapter.synthesizeArtistDoc(...args),
}));
vi.mock("@/lib/lore/generateAboutFromDoc", () => ({
  generateAboutFromDoc: (...args: Parameters<typeof adapter.generateAboutFromDoc>) =>
    adapter.generateAboutFromDoc(...args),
}));
vi.mock("@/lib/lore/generateLoreSummary", () => ({
  generateLoreSummary: (...args: Parameters<typeof adapter.generateLoreSummary>) =>
    adapter.generateLoreSummary(...args),
}));
vi.mock("@/lib/instagram/getSocialPostsOrNull", () => ({ getSocialPostsOrNull: async () => [] }));
vi.mock("@/lib/lore/captionCreditSources", () => ({
  captionCreditSources: async () => ({
    creditedCollaborators: [],
    selfCredits: [],
    artistStatements: [],
  }),
}));
vi.mock("@/lib/auth/verifyPrivyAccessToken", () => ({
  verifyPrivyAccessToken: async (token: string) =>
    token === "synthetic-token" ? "did:privy:synthetic" : null,
}));
vi.mock("@/lib/ai/generateText", () => ({ generateText: denyProvider }));
vi.mock("@/lib/ai/streamText", () => ({ streamText: denyProvider }));
const { GET, PUT, OPTIONS, maxDuration } = await import("../../../../app/api/artistBio/[id]/route");
const { gatherDocMaterial } = await import("../../../../lib/lore/gatherDocMaterial");
const { toSourceList } = await import("../../../../lib/lore/toSourceList");
const artist = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const source = "00000000-0000-4000-8000-000000000003";
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
  await pg.query(
    "insert into artists(id,name,bio) values($1,'Synthetic artist','Original About')",
    [artist],
  );
  await pg.query(
    "insert into users(id,is_admin,privy_user_id) values($1,true,'did:privy:synthetic')",
    [user],
  );
  await pg.query(
    "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'submission','public','approved','https://example.org/synthetic',$3)",
    [source, artist, "Synthetic verified evidence. ".repeat(30)],
  );
  adapter = createHostedAboutAdapter({}, async () => toSourceList(await gatherDocMaterial(artist)));
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
function request(
  method: "GET" | "PUT",
  token: string | null = "synthetic-token",
  signal?: AbortSignal,
) {
  return new Request(
    `http://synthetic.invalid/api/artistBio/${artist}${method === "GET" ? "?regenerate=true" : ""}`,
    {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(method === "PUT" ? { body: JSON.stringify({ regenerate: true }) } : {}),
      signal,
    },
  );
}
const context = () => ({ params: Promise.resolve({ id: artist }) });
it("uses real PUT serialization then public GET and CORS, with one deterministic generation", async () => {
  const result = await PUT(request("PUT"), context());
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    status: "ok",
    message: "Bio regenerated",
    bio: "Synthetic About",
  });
  const read = await GET(
    new Request(`http://synthetic.invalid/api/artistBio/${artist}`),
    context(),
  );
  expect(read.status).toBe(200);
  expect(await read.json()).toMatchObject({ status: "ok", bio: "Synthetic About" });
  expect(read.headers.get("cache-control")).toBe("private, no-store");
  expect((await OPTIONS()).status).toBe(204);
  expect(maxDuration).toBe(60);
  expect(adapter.counters()).toEqual({ lore: 1, about: 1, summary: 1 });
});
it.each(["GET", "PUT"] as const)(
  "refuses missing/invalid auth before model work (%s)",
  async method => {
    for (const token of [null, "invalid"]) {
      const result = await (method === "GET" ? GET : PUT)(request(method, token), context());
      expect(result.status).toBe(401);
      expect(await result.json()).toMatchObject({ status: "error" });
    }
    expect(adapter.counters()).toEqual({ lore: 0, about: 0, summary: 0 });
  },
);
it("uses real role checks and refuses an authenticated nonclaimant", async () => {
  await pg.exec("update users set is_admin=false");
  const result = await PUT(request("PUT"), context());
  expect(result.status).toBe(403);
  expect(adapter.counters()).toEqual({ lore: 0, about: 0, summary: 0 });
});
it.each(["lore", "about"] as const)(
  "reports deterministic %s failure without claiming success or changing About",
  async stage => {
    adapter = createHostedAboutAdapter({ [stage]: "fail" }, async () =>
      toSourceList(await gatherDocMaterial(artist)),
    );
    const result = await PUT(request("PUT"), context());
    expect(result.status).toBe(500);
    expect(await result.json()).toMatchObject({
      status: "error",
      error: expect.stringContaining(stage === "lore" ? "prepare Lore" : "generate About"),
    });
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Original About" }]);
    expect((await pg.query("select * from artist_bio_versions")).rows).toEqual([]);
    expect(
      (await pg.query("select status,claimed_at from artist_research_jobs")).rows,
    ).toMatchObject([{ claimed_at: null }]);
  },
);
it("request cancellation reaches a held boundary, returns 408 and releases its lease", async () => {
  adapter = createHostedAboutAdapter({ about: "wait-for-abort" }, async () =>
    toSourceList(await gatherDocMaterial(artist)),
  );
  const controller = new AbortController();
  const pending = PUT(request("PUT", "synthetic-token", controller.signal), context());
  try {
    await vi.waitFor(() => expect(adapter.counters().about).toBe(1));
    controller.abort(new Error("synthetic cancellation"));
    const result = await pending;
    expect(result.status).toBe(408);
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Original About" }]);
    expect((await pg.query("select claimed_at from artist_research_jobs")).rows).toEqual([
      { claimed_at: null },
    ]);
  } finally {
    controller.abort();
    await pending;
  }
});
