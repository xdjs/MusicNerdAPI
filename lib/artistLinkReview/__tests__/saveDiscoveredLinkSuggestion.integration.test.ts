import { afterAll, beforeEach, expect, it, vi } from "vitest";
const m = await vi.hoisted(async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { renderSql } = await import("@/lib/db/__tests__/renderSql");
  const client = new PGlite();
  await client.exec(
    `create table ugcresearch(id uuid default gen_random_uuid(),artist_id uuid,ugc_url text,site_name text,site_username text,origin text,accepted boolean default false,date_processed timestamp);`,
  );
  const tx = {
    execute: async (q: Parameters<typeof renderSql>[0]) => {
      const s = renderSql(q);
      return (await client.query(s.text, s.params)).rows;
    },
  };
  return {
    client,
    write: vi.fn(),
    tx,
    db: { transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
  };
});
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink: m.write }));
vi.mock("@/lib/db/db", () => ({ db: m.db }));
vi.mock("@/lib/ownership/getArtistOperationOwnership", () => ({
  getArtistOperationOwnership: () => ({ expectedClaimId: null }),
}));
vi.mock("@/lib/ownership/lockScopedArtistWrite", () => ({ lockScopedArtistWrite: async () => {} }));
const { saveDiscoveredLinkSuggestion } =
  await import("@/lib/artistLinkReview/saveDiscoveredLinkSuggestion");
const { setDiscoveredArtistLink } = await import("@/lib/artistLinkReview/setDiscoveredArtistLink");
const artist = "11111111-1111-4111-8111-111111111111";
const p = { siteName: "instagram", value: "nova", profileUrl: "https://instagram.com/nova" };
beforeEach(async () => {
  m.write.mockClear();
  await m.client.exec("truncate ugcresearch");
});
afterAll(async () => m.client.close());
it("persists once across re-entry and preserves a rejection", async () => {
  expect(await saveDiscoveredLinkSuggestion(artist, p)).toBe(true);
  expect(await saveDiscoveredLinkSuggestion(artist, p)).toBe(true);
  const { rows } = await m.client.query("select * from ugcresearch");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ origin: "research", accepted: false, date_processed: null });
  await m.client.exec("update ugcresearch set date_processed=now()");
  expect(await saveDiscoveredLinkSuggestion(artist, p)).toBe(false);
  expect((await m.client.query("select * from ugcresearch")).rows).toHaveLength(1);
});
it("does not resurrect a reviewed duplicate even if an older pending row exists", async () => {
  await saveDiscoveredLinkSuggestion(artist, p);
  await m.client.query(
    "insert into ugcresearch(artist_id,site_name,site_username,date_processed) values($1,'instagram','nova',now())",
    [artist],
  );
  expect(await saveDiscoveredLinkSuggestion(artist, p)).toBe(false);
});

it("preserves an Instagram rejection across handle casing changes", async () => {
  await saveDiscoveredLinkSuggestion(artist, {
    ...p,
    value: "Nova",
    profileUrl: "https://instagram.com/Nova",
  });
  await m.client.exec("update ugcresearch set date_processed=now()");
  expect(await saveDiscoveredLinkSuggestion(artist, p)).toBe(false);
  expect((await m.client.query("select * from ugcresearch")).rows).toHaveLength(1);
});

it("does not resurrect a rejected handle when discovery later treats it as corroborated", async () => {
  await saveDiscoveredLinkSuggestion(artist, p);
  await m.client.exec("update ugcresearch set date_processed=now()");
  expect(await saveDiscoveredLinkSuggestion(artist, p, false)).toBe(false);
});
it("allows a new corroborated identity without inserting a pending review", async () => {
  expect(await saveDiscoveredLinkSuggestion(artist, p, false)).toBe(true);
  expect((await m.client.query("select * from ugcresearch")).rows).toHaveLength(0);
});
it("keeps an already-pending identity for human review when stronger discovery arrives", async () => {
  await saveDiscoveredLinkSuggestion(artist, p);
  expect(await saveDiscoveredLinkSuggestion(artist, p, false)).toBe(false);
});

it("refuses automatic attachment when rejection arrives after candidate selection", async () => {
  expect(await saveDiscoveredLinkSuggestion(artist, p, false)).toBe(true);
  await m.client.query(
    "insert into ugcresearch(artist_id,site_name,site_username,date_processed) values($1,'instagram','Nova',now())",
    [artist],
  );
  await expect(setDiscoveredArtistLink(artist, "instagram", "nova")).rejects.toThrow(
    "explicit confirmation",
  );
  expect(m.write).not.toHaveBeenCalled();
});
it("passes the same checked transaction to an allowed automatic attachment", async () => {
  await setDiscoveredArtistLink(artist, "instagram", "nova");
  expect(m.write).toHaveBeenCalledWith(artist, "instagram", "nova", undefined, m.tx, undefined);
});
