/** Calls real Next route exports in-process; not a Next server or deployed auth test. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
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
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.network);
  pg = new PGlite({ extensions: { pg_trgm } });
  database = drizzle(pg, { schema });
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
    await pg.exec(readFileSync(new URL("../" + file, import.meta.url), "utf8"));
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
  await pg.exec("set role mnweb");
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
it("full bootstrap under mnweb supports real PUT then public GET with one deterministic generation", async () => {
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
it("full bootstrap accepts the approved claimant while refusing an unrelated authenticated user", async () => {
  await pg.exec("reset role");
  await pg.query("update users set is_admin=false where id=$1", [user]);
  await pg.exec("set role mnweb");
  expect((await PUT(request("PUT"), context())).status).toBe(403);
  await pg.exec("reset role");
  await pg.query("insert into artist_claims(artist_id,user_id,status) values($1,$2,'approved')", [
    artist,
    user,
  ]);
  await pg.exec("set role mnweb");
  const response = await PUT(request("PUT"), context());
  expect(response.status).toBe(200);
  expect(adapter.counters()).toEqual({ lore: 1, about: 1, summary: 1 });
});
