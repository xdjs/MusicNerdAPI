import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { it, expect } from "vitest";
import { publicVaultSourceSql } from "../publicVaultSourceSql";
it("separates approval, explicit publication, and inherited claim access", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  await pg.exec(
    `create table artist_claims(artist_id text,status text); create table artist_activity_events(id text,artist_id text,source_id text,actor_kind text,actor_user_id text,trigger text,action text); create table artist_vault_sources(id text,activity_id text,origin text,artist_id text,status text,publication text); insert into artist_vault_sources(artist_id,status,publication) values ('a','approved','inherit');`,
  );
  const read = async () =>
    (await db.execute(sql`select * from artist_vault_sources v where ${publicVaultSourceSql()}`))
      .rows;
  expect(await read()).toHaveLength(0);
  await pg.exec("update artist_vault_sources set publication='public'");
  expect(await read()).toHaveLength(1);
  for (const status of ["pending", "rejected"]) {
    await pg.query("update artist_vault_sources set status=$1", [status]);
    expect(await read()).toHaveLength(0);
  }
  await pg.exec(
    "update artist_vault_sources set status='approved',publication='inherit'; insert into artist_claims values ('a','approved')",
  );
  expect(await read()).toHaveLength(1);
  await pg.exec("update artist_vault_sources set publication='private'");
  expect(await read()).toHaveLength(0);
  await pg.exec("update artist_vault_sources set publication='unexpected'");
  expect(await read()).toHaveLength(0);
  await pg.exec(
    "delete from artist_claims; update artist_vault_sources set id='s',activity_id='e',origin='upload',status='approved',publication='inherit';insert into artist_activity_events values('e','a','s','user','original-user','trusted_submission','source_upload')",
  );
  expect(await read()).toHaveLength(1);
  // No users join: losing today's role does not erase immutable submission trust.
  await pg.exec("update artist_vault_sources set publication='private'");
  expect(await read()).toHaveLength(0);
  await pg.exec("update artist_vault_sources set publication='inherit',status='rejected'");
  expect(await read()).toHaveLength(0);
  await pg.exec(
    "update artist_vault_sources set status='approved';update artist_activity_events set source_id='wrong'",
  );
  expect(await read()).toHaveLength(0);
  await pg.close();
}, 30000);
