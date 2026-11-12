import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("adds optional JSON storage without changing old records or review decisions", async () => {
  const client = new PGlite();
  try {
    await client.exec(
      "create table ugcresearch(id integer primary key,accepted boolean,date_processed timestamp); insert into ugcresearch values(1,false,null),(2,false,'2026-11-01'),(3,true,'2026-11-02');",
    );
    const before = (
      await client.query<Record<string, unknown>>("select * from ugcresearch order by id")
    ).rows;
    await client.exec(
      readFileSync(new URL("./fixtures/0066_discovery_evidence.sql", import.meta.url), "utf8"),
    );
    expect(
      (await client.query<Record<string, unknown>>("select * from ugcresearch order by id")).rows,
    ).toEqual(before.map(row => ({ ...row, discovery_evidence: null })));
    await client.exec("insert into ugcresearch(id,accepted) values(4,false)");
    expect(
      (await client.query("select discovery_evidence from ugcresearch where id=4")).rows,
    ).toEqual([{ discovery_evidence: null }]);
  } finally {
    await client.close();
  }
});
