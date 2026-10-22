import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { postDirectEditLinkHandler } from "@/lib/directEditLink/postDirectEditLinkHandler";
import { postRemoveArtistDataHandler } from "@/lib/removeArtistData/postRemoveArtistDataHandler";
import { getStoredLatestProviders } from "@/lib/latestProviders/getStoredLatestProviders";

const m = vi.hoisted(() => ({ auth: vi.fn(), extract: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/auth/authenticateRequest", () => ({ authenticateRequest: m.auth }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId: m.extract }));
vi.mock("@/lib/directEditLink/notifyDiscordOfArtistLinkAdded", () => ({
  notifyDiscordOfArtistLinkAdded: m.notify,
}));
vi.mock("@/lib/db/db", () => ({
  get db() {
    return adapter;
  },
}));
const client = new PGlite();
const database = drizzle(client, { schema });
function adapt(executor: typeof database) {
  return {
    query: executor.query,
    insert: executor.insert.bind(executor),
    update: executor.update.bind(executor),
    select: executor.select.bind(executor),
    execute: async (q: SQL) => (await executor.execute(q)).rows,
  };
}
let beforeTransaction: (() => Promise<void>) | undefined;
const adapter = {
  ...adapt(database),
  transaction: async (fn: (tx: ReturnType<typeof adapt>) => Promise<unknown>) => {
    const hook = beforeTransaction;
    beforeTransaction = undefined;
    await hook?.();
    return database.transaction(tx => fn(adapt(tx as unknown as typeof database)));
  },
};
const artistId = "00000000-0000-4000-8000-000000001580";
const userId = "00000000-0000-4000-8000-000000001581";
const claimId = "00000000-0000-4000-8000-000000001582";
const otherId = "00000000-0000-4000-8000-000000001583";
const mappingId = "00000000-0000-4000-8000-000000001584";
const spotify = "A".repeat(22);
const tables = [
  schema.artists,
  schema.users,
  schema.artistClaims,
  schema.artistIdMappings,
  schema.artistResearchJobs,
  schema.artistSelfEdits,
  schema.artistLatestProviderSnapshots,
];
const request = (body: object) =>
  new Request("http://localhost/api/directEditLink", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artistId, ...body }),
  });
const clear = (body: object = {}) =>
  postDirectEditLinkHandler(
    request({ action: "clear", siteName: "deezer", expectedValue: "101", ...body }),
  );
const set = (value = "202") =>
  postDirectEditLinkHandler(
    request({ action: "set", url: `https://www.deezer.com/artist/${value}` }),
  );
const row = async () =>
  (await database.select().from(schema.artists).where(eq(schema.artists.id, artistId)))[0];
const query = async (sql: string) => (await client.query<Record<string, unknown>>(sql)).rows;
const privileged = async (sql: string) => {
  await client.exec("RESET ROLE");
  try {
    return await query(sql);
  } finally {
    await client.exec("SET ROLE mnweb");
  }
};
const history = () =>
  query("SELECT old_value,new_value FROM artist_self_edits ORDER BY created_at,id");
const archives = () => privileged("SELECT * FROM musicnerd_private.catalog_link_disconnects");
beforeAll(async () => {
  await client.exec(
    "CREATE ROLE mnweb; CREATE ROLE anon; CREATE ROLE authenticated; CREATE TYPE confidence_level AS ENUM ('high','medium','low','manual'); CREATE TYPE claim_status AS ENUM ('pending','approved','rejected')",
  );
  for (const table of tables) {
    const config = getTableConfig(table);
    await client.exec(
      `CREATE TABLE "${config.name}" (${config.columns.map(c => `"${c.name}" ${c.getSQLType()}`).join(",")}); ALTER TABLE "${config.name}" ENABLE ROW LEVEL SECURITY; CREATE POLICY fixture_app ON "${config.name}" TO mnweb USING (true) WITH CHECK (true); GRANT SELECT,INSERT,UPDATE ON "${config.name}" TO mnweb;`,
    );
  }
  await client.exec(
    "ALTER TABLE artists ADD PRIMARY KEY(id); CREATE UNIQUE INDEX direct_deezer ON artists(deezer) WHERE deezer IS NOT NULL; CREATE UNIQUE INDEX mapping_destination ON artist_id_mappings(platform,platform_id); CREATE UNIQUE INDEX mapping_slot ON artist_id_mappings(artist_id,platform); ALTER TABLE artist_self_edits ALTER COLUMN id SET DEFAULT gen_random_uuid(); ALTER TABLE artist_self_edits ALTER COLUMN created_at SET DEFAULT now(); ALTER TABLE artist_self_edits ADD CONSTRAINT nonempty CHECK(new_value <> '' AND submitted_url <> '')",
  );
  // Exact mirror of Web-owned 0056; copied so API CI needs no sibling repository.
  await client.exec(
    readFileSync(new URL("./fixtures/0056_catalog_disconnect.sql", import.meta.url), "utf8"),
  );
}, 30000);
beforeEach(async () => {
  beforeTransaction = undefined;
  await client.exec(
    "RESET ROLE; DROP TRIGGER IF EXISTS revoke_on_write ON artists; DROP TRIGGER IF EXISTS fail_jobs ON artist_research_jobs; ALTER TABLE artist_self_edits DROP CONSTRAINT IF EXISTS fixture_failure; ALTER TABLE musicnerd_private.catalog_link_disconnects DROP CONSTRAINT IF EXISTS fixture_failure; TRUNCATE artists,users,artist_claims,artist_id_mappings,artist_research_jobs,artist_self_edits,artist_latest_provider_snapshots,musicnerd_private.catalog_link_disconnects",
  );
  await database.insert(schema.artists).values({
    id: artistId,
    name: "Synthetic artist",
    spotify,
    deezer: "101",
    bio: "keep biography",
    instagram: "keep-social",
  });
  await database.insert(schema.users).values([
    { id: userId, isAdmin: false, isWhiteListed: false },
    { id: otherId, isAdmin: false, isWhiteListed: false },
  ]);
  await database
    .insert(schema.artistClaims)
    .values({ id: claimId, artistId, userId, status: "approved" });
  await client.exec(
    `INSERT INTO artist_id_mappings(id,artist_id,platform,platform_id,confidence,source,reasoning,api_key_hash,created_at,updated_at,resolved_at) VALUES ('${mappingId}','${artistId}','deezer','101','medium','name_search','Synthetic original reasoning','synthetic-private-hash',now(),now(),now()); INSERT INTO artist_research_jobs(id,artist_id,kind,status,state) VALUES ('${mappingId}','${artistId}','spotify_match','pending','{}'); INSERT INTO artist_latest_provider_snapshots(artist_id,provider,account_id,items,checked_at,last_attempt_at,status) VALUES ('${artistId}','deezer','101','[]',now(),now(),'checked')`,
  );
  await client.exec("SET ROLE mnweb");
  m.auth.mockReset().mockResolvedValue({ userId });
  m.extract.mockReset().mockImplementation(async (url: string) => ({
    siteName: "deezer",
    id: url.split("/").pop(),
    cardPlatformName: "Deezer",
  }));
  m.notify.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(async () => {
  await client.close();
});
it("real authenticated clear retires exact provenance and permits real explicit replacement", async () => {
  const retainedItem = {
    card: {
      kind: "release",
      id: "old-release",
      title: "Old release",
      date: "2026-01-01",
      text: "Old",
      sourceId: "latest:deezer:101",
      revision: "1",
    },
    original: { sourceId: "latest:deezer:101", revision: "1" },
  };
  await client.query("UPDATE artist_latest_provider_snapshots SET items=$1::jsonb", [
    JSON.stringify([retainedItem]),
  ]);
  expect((await getStoredLatestProviders(artistId)).items).toHaveLength(1);
  const before = await row();
  const mapping = await query("SELECT to_jsonb(m) AS snapshot FROM artist_id_mappings m");
  expect((await set()).status).toBe(409);
  expect((await clear()).status).toBe(200);
  expect(await row()).toEqual({ ...before, deezer: null });
  expect(await query("SELECT * FROM artist_id_mappings")).toEqual([]);
  expect((await archives())[0]).toMatchObject({
    artist_id: artistId,
    old_value: "101",
    actor_user_id: userId,
    claim_id: claimId,
    authorization_mode: "owner",
    mapping_snapshot: mapping[0].snapshot,
  });
  expect(
    (await getStoredLatestProviders(artistId)).coverage.find(c => c.provider === "deezer")?.status,
  ).toBe("disconnected");
  expect((await getStoredLatestProviders(artistId)).items).toEqual([]);
  expect((await set()).status).toBe(200);
  expect((await row()).deezer).toBe("202");
  expect((await getStoredLatestProviders(artistId)).items).toEqual([]);
  expect((await query("SELECT items FROM artist_latest_provider_snapshots"))[0].items).toEqual([
    retainedItem,
  ]);
  expect(await history()).toEqual([{ old_value: null, new_value: "202" }]);
  expect(await query("SELECT status,state FROM artist_research_jobs")).toEqual([
    { status: "done", state: { identityChanged: true, outcome: "identity_changed" } },
  ]);
});
it.each(["direct", "mapping"])(
  "replacement preserves other-artist %s collision checks",
  async kind => {
    expect((await clear()).status).toBe(200);
    await database
      .insert(schema.artists)
      .values({ id: otherId, name: "Other", deezer: kind === "direct" ? "202" : null });
    if (kind === "mapping")
      await database.insert(schema.artistIdMappings).values({
        id: otherId,
        artistId: otherId,
        platform: "deezer",
        platformId: "202",
        confidence: "manual",
        source: "fixture",
      });
    expect((await set()).status).toBe(409);
    expect((await row()).deezer).toBeNull();
    expect(await history()).toEqual([]);
  },
);
it("stale displayed identity refuses without archive or job change", async () => {
  expect((await clear({ expectedValue: "99" })).status).toBe(409);
  expect((await row()).deezer).toBe("101");
  expect(await archives()).toEqual([]);
  expect(await query("SELECT status FROM artist_research_jobs")).toEqual([{ status: "pending" }]);
});
it("claim change after endpoint authorization refuses at the actual disconnect", async () => {
  beforeTransaction = async () => {
    await database.update(schema.artistClaims).set({ status: "rejected" });
  };
  expect((await clear()).status).toBe(403);
  expect((await row()).deezer).toBe("101");
  expect(await archives()).toEqual([]);
});
it("contributor endpoint retains whitelist semantics and rechecks role at write", async () => {
  m.auth.mockResolvedValue({ userId: otherId });
  await database
    .update(schema.users)
    .set({ isWhiteListed: true })
    .where(eq(schema.users.id, otherId));
  beforeTransaction = async () => {
    await database
      .update(schema.users)
      .set({ isWhiteListed: false })
      .where(eq(schema.users.id, otherId));
  };
  expect(
    (await postRemoveArtistDataHandler(request({ siteName: "deezer", expectedValue: "101" })))
      .status,
  ).toBe(403);
  expect(await archives()).toEqual([]);
  await database
    .update(schema.users)
    .set({ isWhiteListed: true })
    .where(eq(schema.users.id, otherId));
  expect(
    (await postRemoveArtistDataHandler(request({ siteName: "deezer", expectedValue: "101" })))
      .status,
  ).toBe(200);
  expect((await archives())[0]).toMatchObject({
    actor_user_id: otherId,
    authorization_mode: "contributor",
  });
});
it("archive failure is explicit 503 with no partial clear or leaked mapping provenance", async () => {
  await privileged(
    "ALTER TABLE musicnerd_private.catalog_link_disconnects ADD CONSTRAINT fixture_failure CHECK(false) NOT VALID",
  );
  const response = await clear();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("synthetic-private-hash");
  expect((await row()).deezer).toBe("101");
  expect(await archives()).toEqual([]);
  expect(await query("SELECT platform_id FROM artist_id_mappings")).toEqual([
    { platform_id: "101" },
  ]);
});
it("missing EXECUTE permission fails closed instead of field-only clear", async () => {
  await privileged(
    "REVOKE EXECUTE ON FUNCTION musicnerd_private.disconnect_catalog_link(uuid,text,text,jsonb,uuid,uuid,text) FROM mnweb",
  );
  try {
    expect((await clear()).status).toBe(503);
    expect((await row()).deezer).toBe("101");
    expect(await archives()).toEqual([]);
  } finally {
    await privileged(
      "GRANT EXECUTE ON FUNCTION musicnerd_private.disconnect_catalog_link(uuid,text,text,jsonb,uuid,uuid,text) TO mnweb",
    );
  }
});
it("two changed saves and idempotent repeat create exactly two self-edit events; clear adds none", async () => {
  expect((await clear()).status).toBe(200);
  expect((await set("202")).status).toBe(200);
  expect((await set("303")).status).toBe(200);
  expect(await (await set("303")).json()).toMatchObject({ changed: false });
  expect(await history()).toHaveLength(2);
  expect((await clear({ expectedValue: "303" })).status).toBe(200);
  expect(await history()).toHaveLength(2);
});
it("unrelated user and unauthenticated requests cannot mutate", async () => {
  m.auth.mockResolvedValue({ userId: otherId });
  expect((await clear()).status).toBe(403);
  m.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  expect((await clear()).status).toBe(401);
  expect((await row()).deezer).toBe("101");
  expect(await archives()).toEqual([]);
});
it("claim revoked during extraction refuses real writer", async () => {
  await clear();
  m.extract.mockImplementationOnce(async () => {
    await database.update(schema.artistClaims).set({ status: "rejected" });
    return { siteName: "deezer", id: "202" };
  });
  expect((await set()).status).toBe(403);
  expect((await row()).deezer).toBeNull();
  expect(await history()).toEqual([]);
});
it("claim revoked after artist update but before audit rolls the whole write back", async () => {
  await clear();
  await client.exec("RESET ROLE");
  await client.exec(
    `CREATE OR REPLACE FUNCTION fixture_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE artist_claims SET status='rejected' WHERE artist_id=NEW.id; RETURN NEW; END $$; CREATE TRIGGER revoke_on_write AFTER UPDATE ON artists FOR EACH ROW EXECUTE FUNCTION fixture_revoke()`,
  );
  await client.exec("SET ROLE mnweb");
  expect((await set()).status).toBe(403);
  expect((await row()).deezer).toBeNull();
  expect(await history()).toEqual([]);
  expect(await query("SELECT status FROM artist_claims")).toEqual([{ status: "approved" }]);
});
it("non-owner admin save succeeds without manufacturing a self edit", async () => {
  await clear();
  await database.update(schema.users).set({ isAdmin: true }).where(eq(schema.users.id, otherId));
  m.auth.mockResolvedValue({ userId: otherId });
  expect((await set()).status).toBe(200);
  expect(await history()).toEqual([]);
});
it("self-edit insertion failure rolls back the real replacement writer", async () => {
  await clear();
  await privileged(
    "ALTER TABLE artist_self_edits ADD CONSTRAINT fixture_failure CHECK(false) NOT VALID",
  );
  expect((await set()).status).toBe(500);
  expect((await row()).deezer).toBeNull();
  expect(await history()).toEqual([]);
});
