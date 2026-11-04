import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { it, expect } from "vitest";
import { publicVaultSourceSql } from "../publicVaultSourceSql";
it("separates approval, explicit publication, and inherited claim access", async () => {
  const pg = new PGlite();
  const db = drizzle(pg);
  await pg.exec(
    `create table artist_claims(artist_id text,status text); create table artist_vault_sources(artist_id text,status text,publication text); insert into artist_vault_sources values ('a','approved','inherit');`,
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
  await pg.close();
});
