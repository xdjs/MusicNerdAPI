import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { artistVaultSources } from "@/lib/db/schema";
const pg = new PGlite();
const database = drizzle(pg);
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { getLoreVaultSources } = await import("../getLoreVaultSources");
it("gathers only eligible evidence and preserves trusted contributions through claiming", async () => {
  const artist = "00000000-0000-4000-8000-000000000001",
    source = "00000000-0000-4000-8000-000000000002",
    event = "00000000-0000-4000-8000-000000000003";
  try {
    const columns = Object.values(getTableColumns(artistVaultSources))
      .map(c => `"${c.name}" ${c.getSQLType().includes("source_status") ? "text" : c.getSQLType()}`)
      .join(",");
    await pg.exec(
      `create table artist_vault_sources(${columns}); create table artist_claims(artist_id uuid,status text); create table artist_activity_events(id uuid,artist_id uuid,source_id uuid,actor_kind text,actor_user_id uuid,trigger text,action text);`,
    );
    await pg.query(
      "insert into artist_vault_sources(id,artist_id,activity_id,origin,status,publication,url,extracted_text) values($1,$2,$3,'upload','approved','inherit','https://example.org/a','Evidence')",
      [source, artist, event],
    );
    expect(await getLoreVaultSources(artist)).toEqual([]);
    await pg.query(
      "insert into artist_activity_events values($1,$2,$3,'user',$2,'trusted_submission','source_upload')",
      [event, artist, source],
    );
    expect(await getLoreVaultSources(artist)).toMatchObject([
      { id: source, activityId: event, publication: "inherit", extractedText: "Evidence" },
    ]);
    await pg.query("insert into artist_claims values($1,'approved')", [artist]);
    expect(await getLoreVaultSources(artist)).toHaveLength(1);
    for (const change of ["publication='private'", "status='pending'", "status='rejected'"]) {
      await pg.exec(`update artist_vault_sources set ${change}`);
      expect(await getLoreVaultSources(artist)).toEqual([]);
      await pg.exec("update artist_vault_sources set publication='inherit',status='approved'");
    }
    await pg.exec("update artist_vault_sources set url='https://example.org/file?token=private'");
    expect(await getLoreVaultSources(artist)).toEqual([]);
    await pg.exec("update artist_vault_sources set url='https://example.org/a'");
    await pg.exec("delete from artist_claims");
    expect(await getLoreVaultSources(artist)).toHaveLength(1);
  } finally {
    await pg.close();
  }
}, 30000);
