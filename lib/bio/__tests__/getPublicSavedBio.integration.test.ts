import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import { vaultSourceRevision } from "@/lib/lore/vaultSourceRevision";
import { getPublicSavedBio } from "../getPublicSavedBio";
vi.mock("@/lib/db/db", () => ({ db: {} }));
it("rechecks immutable trust, claim scope, privacy and moderation without rewriting history", async () => {
  const pg = new PGlite(),
    db = drizzle(pg);
  const artist = "00000000-0000-4000-8000-000000000001",
    sourceId = "00000000-0000-4000-8000-000000000002",
    event = "00000000-0000-4000-8000-000000000003",
    claim = "00000000-0000-4000-8000-000000000004";
  const source = {
    id: sourceId,
    url: "https://example.org/source",
    activityId: event,
    origin: "submission",
    publication: "inherit",
    extractedText: "Saved evidence",
  };
  const bio = "Generated biography.";
  const provenance = {
    version: 1,
    kind: "generated",
    bioHash: createHash("sha256").update(bio).digest("hex"),
    claimId: null,
    sources: [{ id: 1, kind: "vault", url: source.url, revision: vaultSourceRevision(source) }],
  };
  try {
    await pg.exec(
      `create table artists(id uuid,bio text); create schema mn_private;create table mn_private.legacy_bio_publications(artist_id uuid primary key,claim_id uuid not null,bio_hash text not null); create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb);create table artist_claims(id uuid,artist_id uuid,status text);create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,actor_user_id uuid,trigger text,action text);create table artist_vault_sources(id uuid,artist_id uuid,activity_id uuid,origin text,publication text,status text,url text,extracted_text text,title text,snippet text,published_at text,file_path text);`,
    );
    await pg.query("insert into artists values($1,$2)", [artist, bio]);
    await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
      artist,
      JSON.stringify(provenance),
    ]);
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,activity_id,origin,publication,status,url,extracted_text) values($1,$2,$3,'submission','inherit','approved',$4,$5)",
      [sourceId, artist, event, source.url, source.extractedText],
    );
    const read = () => getPublicSavedBio(artist, db as never);
    expect(await read()).toBeNull();
    await pg.query(
      "insert into artist_activity_events values($1,$2,$3,'user',$2,'trusted_submission','source_submission')",
      [event, artist, sourceId],
    );
    expect(await read()).toBe(bio);
    await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
    expect(await read()).toBe(bio);
    for (const change of [
      "publication='private'",
      "status='rejected'",
      "status='pending'",
      "extracted_text='changed'",
    ]) {
      await pg.exec(`update artist_vault_sources set ${change}`);
      expect(await read()).toBeNull();
      await pg.query(
        "update artist_vault_sources set publication='inherit',status='approved',extracted_text=$1",
        [source.extractedText],
      );
    }
    await pg.exec("delete from artist_claims;update artist_activity_events set source_id=null");
    expect(await read()).toBeNull();
    expect(
      (
        await pg.query(
          "select a.bio,p.provenance as bio_provenance from artists a left join mn_private.artist_bio_provenance p on p.artist_id=a.id",
        )
      ).rows,
    ).toEqual([{ bio, bio_provenance: provenance }]);
  } finally {
    await pg.close();
  }
}, 30000);

it("does not downgrade a private metadata permission/read failure to legacy prose", async () => {
  await expect(
    getPublicSavedBio("00000000-0000-4000-8000-000000000001", {
      execute: async () => {
        throw new Error("permission denied for schema mn_private");
      },
    } as never),
  ).rejects.toThrow("permission denied");
});

it("hides claimed legacy and unsupported generated text without modifying raw or pinned history", async () => {
  const pg = new PGlite(),
    db = drizzle(pg);
  const artist = "00000000-0000-4000-8000-000000000001",
    claim = "00000000-0000-4000-8000-000000000002";
  const bio = "Preserved legacy bytes";
  try {
    await pg.exec(
      "create table artists(id uuid,bio text);create schema mn_private;create table mn_private.legacy_bio_publications(artist_id uuid primary key,claim_id uuid not null,bio_hash text not null);create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb);create table artist_claims(id uuid,artist_id uuid,status text);create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,actor_user_id uuid,trigger text,action text);create table artist_vault_sources(id uuid,artist_id uuid,activity_id uuid,origin text,publication text,status text,url text,extracted_text text,title text,snippet text,published_at text,file_path text);create table artist_bio_versions(bio_text text,is_pinned boolean)",
    );
    await pg.query("insert into artists values($1,$2)", [artist, bio]);
    await pg.query("insert into artist_claims values($1,$2,'approved')", [claim, artist]);
    await pg.query("insert into artist_bio_versions values($1,true)", [bio]);
    const read = () => getPublicSavedBio(artist, db as never);
    expect(await read()).toBeNull();
    const p = {
      version: 1,
      kind: "generated",
      bioHash: createHash("sha256").update(bio).digest("hex"),
      claimId: claim,
      sources: [],
    };
    await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
      artist,
      JSON.stringify(p),
    ]);
    expect(await read()).toBeNull();
    await pg.query("update mn_private.artist_bio_provenance set provenance=$1", [
      JSON.stringify({ ...p, kind: "authored" }),
    ]);
    expect(await read()).toBe(bio);
    await pg.exec("update artist_claims set status='revoked'");
    expect(await read()).toBeNull();
    expect((await pg.query("select bio from artists")).rows).toEqual([{ bio }]);
    expect((await pg.query("select * from artist_bio_versions")).rows).toEqual([
      { bio_text: bio, is_pinned: true },
    ]);
  } finally {
    await pg.close();
  }
});
