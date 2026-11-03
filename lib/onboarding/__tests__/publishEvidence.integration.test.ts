import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { sanitizeDocSources } from "../sanitizeDocSources";
import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";
const m = vi.hoisted(() => ({ transaction: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/db/lockArtistRow", () => ({ lockArtistRow: vi.fn() }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({
  findApprovedClaim: vi.fn(async () => ({ id: "claim" })),
}));
vi.mock("@/lib/bio/saveBioVersions", () => ({ saveBioVersions: vi.fn() }));
vi.mock("@/lib/activity/recordArtistActivity", () => ({ recordArtistActivity: vi.fn() }));
const { persistArtistBio } = await import("@/lib/bio/persistArtistBio");
const pg = new PGlite();
const driver = drizzle(pg);
const artist = "00000000-0000-4000-8000-000000000001";
const source = {
  id: "s",
  activityId: null,
  origin: "submission",
  publication: "inherit",
  url: "https://example.org/a",
  extractedText: "Verified evidence. ".repeat(40),
};
const other = { ...source, id: "other", url: "https://example.org/uncited" };
const manifest = [source, other].map((s, index) => ({
  id: index + 1,
  kind: "vault" as const,
  label: "Source",
  url: s.url,
  revision: vaultSourceRevision(s),
}));
beforeAll(async () => {
  await pg.exec(`create schema mn_private;create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb);create table artist_claims(artist_id uuid,status text);
 create table artist_activity_events(id text,artist_id uuid,source_id text,actor_kind text,actor_user_id text,trigger text,action text);
 create table artist_vault_sources(id text,artist_id uuid,activity_id text,type text,origin text,status text,publication text,url text,extracted_text text,file_path text,title text,snippet text,published_at text);`);
});
afterAll(() => pg.close());
beforeEach(async () => {
  await pg.exec("truncate artist_claims,artist_activity_events,artist_vault_sources");
  await pg.query("insert into artist_claims values($1,'approved')", [artist]);
  for (const s of [source, other])
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'submission','inherit','approved',$3,$4)",
      [s.id, artist, s.url, s.extractedText],
    );
  m.insert.mockReset().mockReturnValue({
    values: () => ({ onConflictDoUpdate: async () => {}, onConflictDoNothing: async () => {} }),
  });
  m.update.mockReset().mockReturnValue({ set: () => ({ where: async () => {} }) });
  m.transaction.mockImplementation(async fn =>
    driver.transaction(tx =>
      fn({
        execute: tx.execute.bind(tx),
        insert: m.insert,
        update: m.update,
        query: {
          artists: { findFirst: async () => ({ id: artist, bio: "Existing About" }) },
          artistBioVersions: { findFirst: async () => undefined },
        },
      }),
    ),
  );
});
const publish = () =>
  persistArtistBio(artist, "New About", {
    ownership: { expectedClaimId: "claim" },
    generated: true,
    expectedBio: "Existing About",
    document: {
      content: "Lore cites only the first source [1].",
      sources: sanitizeDocSources(JSON.parse(JSON.stringify(manifest))),
    },
    confirmSteps: ["publish"],
  });
it("round-trips full evidence through sanitization into the actual persistence source gate", async () => {
  await expect(publish()).resolves.toBe("New About");
  expect(m.insert).toHaveBeenCalled();
  expect(m.update).toHaveBeenCalled();
});
it.each(["publication='private'", "status='rejected'"])(
  "refuses publication when even uncited input changes: %s",
  async change => {
    await pg.exec(`update artist_vault_sources set ${change} where id='other'`);
    await expect(publish()).rejects.toThrow("Lore sources changed");
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  },
);

it("allows an artist-authored source-free draft only when no eligible vault evidence exists", async () => {
  const input = {
    ownership: { expectedClaimId: "claim" },
    generated: true,
    expectedBio: "Existing About",
    document: { content: "Artist-authored draft", sources: [] },
  };
  await expect(persistArtistBio(artist, "Artist's own words", input)).rejects.toThrow(
    "Lore sources changed",
  );
  await pg.exec("delete from artist_vault_sources");
  await expect(persistArtistBio(artist, "Artist's own words", input)).resolves.toBe(
    "Artist's own words",
  );
});
