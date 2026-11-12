import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFile } from "node:fs/promises";
const pg = new PGlite({ extensions: { pg_trgm } });
try {
  await pg.exec(
    "create role mnweb;create role mn_bot;create role webmapdata_editor;create role anon;create role authenticated",
  );
  for (const f of [
    "fresh-schema.bootstrap.sql",
    "bootstrap-functions.sql",
    "bootstrap-reset-access.sql",
    "bootstrap-access.sql",
    "bootstrap-audit.sql",
  ])
    await pg.exec(await readFile("synthetic-sql/" + f, "utf8"));
  const r = await pg.query("select count(*)::int n from artists");
  if (r.rows[0].n !== 0) throw Error("Nonempty fixture baseline");
  const v = await pg.query("select version() version");
  console.log(
    JSON.stringify({
      wasmBootstrap: "passed",
      platform: process.platform,
      engine: v.rows[0].version,
      realRecords: 0,
    }),
  );
} finally {
  await pg.close();
}
