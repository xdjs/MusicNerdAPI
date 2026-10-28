import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
const client = new PGlite();
beforeAll(async () => {
  await client.exec(`CREATE ROLE mnweb; CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA musicnerd_private; GRANT USAGE ON SCHEMA musicnerd_private TO mnweb;
    CREATE TABLE musicnerd_private.catalog_link_disconnects(artist_id uuid,platform text);
    REVOKE ALL ON musicnerd_private.catalog_link_disconnects FROM PUBLIC,mnweb,anon,authenticated;`);
  await client.exec(
    readFileSync(
      new URL("./fixtures/0058_catalog_automatic_reconnect_guard.sql", import.meta.url),
      "utf8",
    ),
  );
});
afterAll(async () => {
  await client.close();
});
it("allows the app to check prior disconnection without reading archive contents", async () => {
  await client.exec(
    `INSERT INTO musicnerd_private.catalog_link_disconnects VALUES ('11111111-1111-4111-8111-111111111111','deezer'); SET ROLE mnweb`,
  );
  expect(
    (
      await client.query(
        `SELECT musicnerd_private.catalog_link_was_disconnected('11111111-1111-4111-8111-111111111111','deezer') AS blocked`,
      )
    ).rows,
  ).toEqual([{ blocked: true }]);
  expect(
    (
      await client.query(
        `SELECT musicnerd_private.catalog_link_was_disconnected('11111111-1111-4111-8111-111111111111','spotify') AS blocked`,
      )
    ).rows,
  ).toEqual([{ blocked: false }]);
  await expect(
    client.query("SELECT * FROM musicnerd_private.catalog_link_disconnects"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    client.query(
      `SELECT musicnerd_private.catalog_link_was_disconnected('11111111-1111-4111-8111-111111111111','instagram')`,
    ),
  ).rejects.toThrow();
  await client.exec("RESET ROLE");
});
it("does not expose the boolean helper to public roles", async () => {
  const rows = (
    await client.query(
      `SELECT has_function_privilege('anon','musicnerd_private.catalog_link_was_disconnected(uuid,text)','EXECUTE') AS anon, has_function_privilege('authenticated','musicnerd_private.catalog_link_was_disconnected(uuid,text)','EXECUTE') AS authenticated`,
    )
  ).rows;
  expect(rows).toEqual([{ anon: false, authenticated: false }]);
});
