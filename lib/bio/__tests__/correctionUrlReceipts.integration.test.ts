import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rowsOf } from "@/lib/db/rowsOf";
import * as schema from "@/lib/db/schema";
import type { TransactionDb } from "@/lib/ownership/types";
let pg: PGlite;
let database: ReturnType<typeof drizzle>;
vi.mock("@/lib/db/db", () => ({
  db: {
    transaction: (callback: (tx: TransactionDb) => Promise<unknown>) =>
      database.transaction(tx =>
        callback(
          new Proxy(tx, {
            get(target, property, receiver) {
              // Match postgres-js execute result shape used by correction SQL, preserving the actual transaction.
              if (property === "execute")
                return async (query: Parameters<typeof tx.execute>[0]) =>
                  rowsOf(await tx.execute(query));
              return Reflect.get(target, property, receiver);
            },
          }) as unknown as TransactionDb,
        ),
      ),
  },
}));
// Revision selection is tested separately. This fixture exercises actual admin lock/write/history transaction.
vi.mock("@/lib/bioCorrections/getCorrectionAbout", () => ({
  getCorrectionAbout: async () => ({
    revision: "synthetic",
    claimed: true,
    storage: "artist",
    bio: "Original",
  }),
}));
const { saveCorrectionAbout } = await import("@/lib/bioCorrections/saveCorrectionAbout");
const artist = "00000000-0000-4000-8000-000000000001",
  user = "00000000-0000-4000-8000-000000000002",
  report = "00000000-0000-4000-8000-000000000003";
const url = "https://example.org/correction";
beforeEach(async () => {
  pg = new PGlite();
  database = drizzle(pg);
  await pg.exec(
    "create schema mn_private;create table mn_private.public_url_receipts(url_hash bytea,url text,policy_version integer,primary key(url_hash,policy_version));create table artists(id uuid,bio text);create table users(id uuid,is_admin boolean);create table artist_bio_corrections(id uuid,artist_id uuid,status text,reviewed_at timestamptz,reviewed_by uuid);create table artist_directory_preparations(artist_id uuid);create table artist_bio_versions(id uuid default gen_random_uuid(),artist_id uuid,bio_text text,is_pinned boolean);create table mn_private.artist_bio_version_provenance(version_id uuid,provenance jsonb);create table mn_private.artist_bio_provenance(artist_id uuid primary key,provenance jsonb)",
  );
  // Exercise the actual reviewed fence, not a mocked writer-marker assertion.
  await pg.exec(
    readFileSync(
      new URL(
        "../../../docs/prototypes/pg17-ci/fixtures/0065_about_writer_fence.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const columns = Object.values(getTableColumns(schema.artistActivityEvents))
    .map(
      c =>
        `"${c.name}" ${"enumValues" in c && Array.isArray(c.enumValues) ? "text" : c.getSQLType()}${c.name === "id" ? " default gen_random_uuid()" : ""}`,
    )
    .join(",");
  await pg.exec(`create table artist_activity_events(${columns})`);
  await pg.query("insert into artists values($1,'Original');", [artist]);
  await pg.query("insert into users values($1,true)", [user]);
  await pg.query(
    "insert into artist_bio_corrections(id,artist_id,status) values($1,$2,'pending')",
    [report, artist],
  );
  await pg.query("insert into mn_private.artist_bio_provenance values($1,$2)", [
    artist,
    JSON.stringify({
      version: 1,
      kind: "generated",
      claimId: null,
      bioHash: createHash("sha256").update("Original").digest("hex"),
      sources: [{ url }],
    }),
  ]);
});
afterEach(async () => {
  await pg.close();
});
it("commits correction text, both history lineages, receipt and report resolution together", async () => {
  await saveCorrectionAbout(report, user, "Corrected", "synthetic");
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Corrected" }]);
  expect((await pg.query("select url from mn_private.public_url_receipts")).rows).toEqual([
    { url },
  ]);
  expect(
    (await pg.query("select count(*)::integer n from mn_private.artist_bio_version_provenance"))
      .rows,
  ).toEqual([{ n: 2 }]);
  expect((await pg.query("select status from artist_bio_corrections")).rows).toEqual([
    { status: "resolved" },
  ]);
});
it("rolls back correction and report resolution when receipt storage fails", async () => {
  await pg.exec(
    "create function reject_receipt() returns trigger language plpgsql as $$begin raise exception 'Receipt unavailable';end$$;create trigger reject_receipt before insert on mn_private.public_url_receipts for each row execute function reject_receipt()",
  );
  await expect(saveCorrectionAbout(report, user, "Corrected", "synthetic")).rejects.toThrow(
    "Could not prepare About URL receipts",
  );
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Original" }]);
  expect((await pg.query("select status from artist_bio_corrections")).rows).toEqual([
    { status: "pending" },
  ]);
  expect((await pg.query("select * from artist_bio_versions")).rows).toEqual([]);
});

it("does not leak the compatible writer marker beyond the correction transaction", async () => {
  await saveCorrectionAbout(report, user, "Corrected", "synthetic");
  await expect(
    pg.query("update artists set bio='Unmarked overwrite' where id=$1", [artist]),
  ).rejects.toMatchObject({ code: "55000" });
  expect((await pg.query("select bio from artists")).rows).toEqual([{ bio: "Corrected" }]);
});
