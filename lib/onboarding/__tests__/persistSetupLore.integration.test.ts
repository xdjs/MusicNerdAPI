import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
const pg = new PGlite();
const database = drizzle(pg);
const m = vi.hoisted(() => ({ auth: vi.fn(), sources: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
vi.mock("@/lib/ownership/authorizeLockedArtistWrite", () => ({
  authorizeLockedArtistWrite: m.auth,
}));
vi.mock("@/lib/lore/assertLoreSourcesCurrent", () => ({ assertLoreSourcesCurrent: m.sources }));
const { persistSetupLore } = await import("../persistSetupLore");
const artist = "00000000-0000-4000-8000-000000000001";
const ownership = { userId: "owner", expectedClaimId: "claim" };
const document = { content: "Prepared research", sources: [] };
beforeAll(async () => {
  await pg.exec(`create table artists(id uuid primary key,bio text);
 create table artist_docs(artist_id uuid primary key,content text,sources jsonb,updated_at timestamptz default now());
 create table artist_bio_versions(artist_id uuid,bio_text text,is_pinned boolean);
 create table artist_onboarding_steps(artist_id uuid,step text,unique(artist_id,step));
 create schema mn_private;create table mn_private.artist_bio_provenance(artist_id uuid,provenance jsonb);`);
});
afterAll(() => pg.close());
beforeEach(async () => {
  vi.resetAllMocks();
  await pg.exec(
    "truncate artists,artist_docs,artist_bio_versions,artist_onboarding_steps,mn_private.artist_bio_provenance",
  );
  await pg.query("insert into artists values($1,'Original human About')", [artist]);
  await pg.query("insert into artist_bio_versions values($1,'Pinned history',true)", [artist]);
  await pg.query('insert into mn_private.artist_bio_provenance values($1,\'{"kind":"manual"}\')', [
    artist,
  ]);
});
it("saves setup material while preserving exact current text, pinned history and private lineage", async () => {
  await persistSetupLore(artist, ownership, document, null);
  expect((await pg.query("select bio from artists")).rows).toEqual([
    { bio: "Original human About" },
  ]);
  expect((await pg.query("select bio_text,is_pinned from artist_bio_versions")).rows).toEqual([
    { bio_text: "Pinned history", is_pinned: true },
  ]);
  expect((await pg.query("select provenance from mn_private.artist_bio_provenance")).rows).toEqual([
    { provenance: { kind: "manual" } },
  ]);
  expect((await pg.query("select content from artist_docs")).rows).toEqual([
    { content: document.content },
  ]);
  expect((await pg.query("select step from artist_onboarding_steps order by step")).rows).toEqual([
    { step: "interview" },
    { step: "publish" },
  ]);
});
it("accepts equivalent JSON key order and exact microsecond timestamps; rejects a later edit", async () => {
  const expected = {
    content: "Before",
    sources: [{ b: 2, a: 1 }],
    updatedAt: "2026-01-01 00:00:00.123456+00",
  };
  await pg.query("insert into artist_docs values($1,$2,$3,$4)", [
    artist,
    expected.content,
    JSON.stringify(expected.sources),
    expected.updatedAt,
  ]);
  await persistSetupLore(artist, ownership, document, expected);
  await expect(
    persistSetupLore(artist, ownership, { ...document, content: "Stale" }, expected),
  ).rejects.toThrow("Lore sources changed");
  expect((await pg.query("select content from artist_docs")).rows).toEqual([
    { content: document.content },
  ]);
});
it("rolls back Lore if confirming setup fails", async () => {
  await pg.exec(
    "alter table artist_onboarding_steps add constraint reject_publish check(step <> 'publish')",
  );
  try {
    await expect(persistSetupLore(artist, ownership, document, null)).rejects.toThrow();
    expect((await pg.query("select * from artist_docs")).rows).toEqual([]);
    expect((await pg.query("select * from artist_onboarding_steps")).rows).toEqual([]);
    expect((await pg.query("select bio from artists")).rows).toEqual([
      { bio: "Original human About" },
    ]);
  } finally {
    await pg.exec("alter table artist_onboarding_steps drop constraint reject_publish");
  }
});
it("rejects removed approval or changed ownership without publishing material", async () => {
  m.sources.mockRejectedValueOnce(new Error("source no longer public"));
  await expect(persistSetupLore(artist, ownership, document, null)).rejects.toThrow(
    "source no longer public",
  );
  m.auth.mockRejectedValueOnce(new Error("claim changed"));
  await expect(persistSetupLore(artist, ownership, document, null)).rejects.toThrow(
    "claim changed",
  );
  expect((await pg.query("select * from artist_docs")).rows).toEqual([]);
});

it("retains baseline edited Lore verbatim, without asserting fresh evidence or altering lineage", async () => {
  const expected = {
    content: "Artist edited this Lore",
    sources: [],
    updatedAt: "2026-01-01 00:00:00.123456+00",
  };
  await pg.query("insert into artist_docs values($1,$2,$3,$4)", [
    artist,
    expected.content,
    JSON.stringify(expected.sources),
    expected.updatedAt,
  ]);
  const before = (await pg.query("select * from artist_docs")).rows;
  await persistSetupLore(artist, ownership, null, expected);
  expect((await pg.query("select * from artist_docs")).rows).toEqual(before);
  expect(m.sources).not.toHaveBeenCalled();
  expect((await pg.query("select bio from artists")).rows).toEqual([
    { bio: "Original human About" },
  ]);
  expect(
    (await pg.query("select count(*)::int as count from artist_onboarding_steps")).rows,
  ).toEqual([{ count: 2 }]);
});
