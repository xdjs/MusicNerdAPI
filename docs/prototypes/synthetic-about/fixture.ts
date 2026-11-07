import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const artist = "00000000-0000-4000-8000-000000000001";
export const user = "00000000-0000-4000-8000-000000000002";
export const source = "00000000-0000-4000-8000-000000000003";
export async function createFixture(
  subject: string,
  admin: boolean,
  sqlRoot = join(process.cwd(), "synthetic-sql"),
) {
  const pg = new PGlite({ extensions: { pg_trgm } });
  try {
    await pg.exec(
      "create role mnweb;create role mn_bot;create role webmapdata_editor;create role anon;create role authenticated",
    );
    for (const name of [
      "fresh-schema.bootstrap.sql",
      "bootstrap-functions.sql",
      "bootstrap-reset-access.sql",
      "bootstrap-access.sql",
      "bootstrap-audit.sql",
    ])
      await pg.exec(await readFile(join(sqlRoot, name), "utf8"));
    await pg.exec("begin");
    await pg.query(
      "insert into artists(id,name,bio) values($1,'Synthetic artist','Original About')",
      [artist],
    );
    await pg.query("insert into users(id,is_admin,privy_user_id) values($1,$2,$3)", [
      user,
      admin,
      subject,
    ]);
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,origin,publication,status,url,extracted_text) values($1,$2,'submission','public','approved','https://example.org/synthetic',$3)",
      [source, artist, "Synthetic verified evidence. ".repeat(30)],
    );
    await pg.query(
      "update artist_research_jobs set status='done',state=state || '{\"outcome\":\"synthetic_fixture_do_not_run\"}'::jsonb where artist_id=$1 and kind='catalog_match'",
      [artist],
    );
    await pg.exec("commit");
    await pg.exec("set role mnweb");
    return pg;
  } catch (error) {
    await pg.close();
    throw error;
  }
}
