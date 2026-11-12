import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { it, expect } from "vitest";
import { publicTextVaultSourceSql } from "../publicTextVaultSourceSql";
it("routes trusted unclaimed text uploads through public originals, with no binary/private/moderated bypass", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  try {
    await pg.exec(`create table artist_claims(artist_id text,status text);
 create table artist_activity_events(id text,artist_id text,source_id text,actor_kind text,actor_user_id text,trigger text,action text);
 create table artist_vault_sources(id text,artist_id text,activity_id text,origin text,status text,publication text,file_path text,content_type text);
 insert into artist_vault_sources values('s','a','e','upload','approved','inherit','a/file','text/plain');
 insert into artist_activity_events values('e','a','s','user','u','trusted_submission','source_upload');`);
    const read = async () =>
      (
        await db.execute(
          sql`select id from artist_vault_sources v where ${publicTextVaultSourceSql()}`,
        )
      ).rows;
    expect(await read()).toHaveLength(1);
    for (const type of ["application/pdf", "image/png", "audio/mpeg"]) {
      await pg.query("update artist_vault_sources set content_type=$1", [type]);
      expect(await read()).toHaveLength(0);
    }
    await pg.exec(
      "update artist_vault_sources set content_type='text/markdown',publication='private'",
    );
    expect(await read()).toHaveLength(0);
    await pg.exec("update artist_vault_sources set publication='inherit',status='pending'");
    expect(await read()).toHaveLength(0);
    await pg.exec(
      "update artist_vault_sources set status='approved';update artist_activity_events set actor_user_id=null",
    );
    expect(await read()).toHaveLength(0);
  } finally {
    await pg.close();
  }
}, 30000);
