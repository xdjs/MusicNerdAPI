import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { expect, it } from "vitest";
import { assertLoreSourcesCurrent } from "../assertLoreSourcesCurrent";
import { vaultSourceRevision } from "../vaultSourceRevision";
const artist = "00000000-0000-4000-8000-000000000001";
const source = {
  id: "s",
  activityId: "e",
  origin: "submission",
  publication: "inherit",
  url: "https://example.org/a",
  extractedText: "Verified evidence. ".repeat(40),
};
it("fences trusted unclaimed evidence across claiming, privacy, rejection and provenance changes", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  try {
    await pg.exec(`create table artist_claims(artist_id uuid,status text);
 create table artist_activity_events(id text,artist_id uuid,source_id text,actor_kind text,actor_user_id text,trigger text,action text);
 create table artist_vault_sources(id text,artist_id uuid,activity_id text,type text, origin text,status text,publication text,url text,extracted_text text,file_path text,title text,snippet text,published_at text);`);
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,activity_id,origin,status,publication,url,extracted_text,file_path,title,snippet,published_at) values('s',$1,'e','submission','approved','inherit',$2,$3,null,null,null,null)",
      [artist, source.url, source.extractedText],
    );
    await pg.query(
      "insert into artist_activity_events values('e',$1,'s','user','u','trusted_submission','source_submission')",
      [artist],
    );
    await pg.exec(
      "create schema mn_private;create role mnweb;create role anon;create role authenticated;",
    );
    await pg.exec(
      readFileSync(
        new URL(
          "../../../docs/prototypes/pg17-ci/fixtures/0064_lore_activity_lock.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const manifest = [
      {
        id: 1,
        kind: "vault" as const,
        label: "A",
        url: source.url,
        revision: vaultSourceRevision(source),
      },
    ];
    const check = () =>
      db.transaction(tx => assertLoreSourcesCurrent(tx as never, artist, manifest));
    await expect(check()).resolves.toBeUndefined();
    await pg.query("insert into artist_claims values($1,'approved')", [artist]);
    await expect(check()).resolves.toBeUndefined();
    await pg.exec("delete from artist_claims");
    await expect(check()).resolves.toBeUndefined();
    for (const update of [
      "publication='private'",
      "status='rejected'",
      "activity_id='missing'",
      "publication='public'",
    ]) {
      await pg.exec(`update artist_vault_sources set ${update}`);
      await expect(check()).rejects.toThrow("Lore sources changed");
      await pg.exec(
        "update artist_vault_sources set publication='inherit',status='approved',activity_id='e'",
      );
    }
    await pg.exec("update artist_activity_events set source_id='other'");
    await expect(check()).rejects.toThrow("Lore sources changed");
  } finally {
    await pg.close();
  }
}, 30000);
