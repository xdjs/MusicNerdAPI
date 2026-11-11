import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableColumns, getTableName } from "drizzle-orm";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import { db } from "@/lib/db/db";
import { independentUploadReceipt } from "../independentUploadReceipt";
import type { IndependentUploadTicket } from "../independentUploadTypes";
vi.mock("@/lib/db/db", () => ({ db: { transaction: vi.fn() } }));
const pg = new PGlite();
const sqlDb = drizzle(pg, { schema });
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ticket: IndependentUploadTicket = {
  scope: "contribution",
  sourceId: id(3),
  expectedClaimId: null,
  userId: id(2),
  artistId: id(1),
  path: `${id(1)}/${id(3)}_a.txt`,
  name: "a.txt",
  type: "text/plain",
  size: 4,
  expires: Date.now() + 60000,
};
const content = {
  url: "https://fixture.invalid/a.txt",
  extractedText: "body",
  sourceType: "document",
};
beforeAll(async () => {
  await pg.exec(
    "create table artists(id uuid primary key);create table users(id uuid primary key,is_admin boolean,is_white_listed boolean);create table artist_claims(id uuid,artist_id uuid,status text)",
  );
  const tables = [schema.artistActivityEvents, schema.artistVaultSources];
  const enums = new Map<string, string[]>();
  for (const table of tables)
    for (const column of Object.values(getTableColumns(table)))
      if (
        "enumValues" in column &&
        Array.isArray(column.enumValues) &&
        column.enumValues.length &&
        column.getSQLType() !== "text"
      )
        enums.set(column.getSQLType(), column.enumValues as string[]);
  for (const [name, values] of enums)
    await pg.exec(`create type ${name} as enum (${values.map(v => `'${v}'`).join(",")})`);
  for (const table of tables)
    await pg.exec(
      `create table ${getTableName(table)} (${Object.values(getTableColumns(table))
        .map(
          c =>
            `"${c.name}" ${c.getSQLType()}${c.name === "id" ? " primary key default gen_random_uuid()" : ""}`,
        )
        .join(",")})`,
    );
  vi.mocked(db.transaction).mockImplementation(
    sqlDb.transaction.bind(sqlDb) as unknown as typeof db.transaction,
  );
}, 30000);
afterAll(() => pg.close());
beforeEach(async () => {
  await pg.exec(
    `truncate artist_vault_sources,artist_activity_events,artists,users,artist_claims;insert into artists values('${ticket.artistId}');insert into users values('${ticket.userId}',false,true)`,
  );
});
it("admits trusted unclaimed Lore without creating claim/onboarding state", async () => {
  expect(await independentUploadReceipt(ticket)).toBeUndefined();
  expect(await independentUploadReceipt(ticket, content)).toEqual({ id: ticket.sourceId });
  expect((await pg.query("select * from artist_claims")).rows).toHaveLength(0);
  expect((await pg.query("select trigger,source_id from artist_activity_events")).rows).toEqual([
    { trigger: "trusted_submission", source_id: ticket.sourceId },
  ]);
});
it("rechecks role after admission; role loss before insert cannot mint trusted content", async () => {
  await independentUploadReceipt(ticket);
  await pg.exec("update users set is_white_listed=false");
  await expect(independentUploadReceipt(ticket, content)).rejects.toThrow();
  expect((await pg.query("select * from artist_activity_events")).rows).toHaveLength(0);
});
it("retains submission-time trust across role loss and claim lifecycle; returns only own receipt", async () => {
  await independentUploadReceipt(ticket, content);
  await pg.exec(
    `update users set is_white_listed=false;insert into artist_claims values('${id(4)}','${ticket.artistId}','approved');delete from artist_claims`,
  );
  expect(await independentUploadReceipt(ticket)).toEqual({ id: ticket.sourceId });
  expect(await independentUploadReceipt(ticket, content)).toEqual({ id: ticket.sourceId });
  expect((await pg.query("select * from artist_vault_sources")).rows).toHaveLength(1);
});
it("does not rewrite private/rejected moderation on retry or return its body", async () => {
  await independentUploadReceipt(ticket, content);
  await pg.exec("update artist_vault_sources set publication='private',status='rejected'");
  expect(await independentUploadReceipt(ticket, content)).toEqual({ id: ticket.sourceId });
  expect((await pg.query("select publication,status from artist_vault_sources")).rows).toEqual([
    { publication: "private", status: "rejected" },
  ]);
});
it("durable original event prevents resurrection after deletion", async () => {
  await independentUploadReceipt(ticket, content);
  await pg.exec("delete from artist_vault_sources");
  await expect(independentUploadReceipt(ticket, content)).rejects.toThrow("CONTRIBUTION_REMOVED");
  expect((await pg.query("select * from artist_vault_sources")).rows).toHaveLength(0);
});
it("rejects another actor or mismatched path even for a completed upload", async () => {
  await independentUploadReceipt(ticket, content);
  await expect(independentUploadReceipt({ ...ticket, userId: id(9) })).rejects.toThrow();
  await expect(independentUploadReceipt({ ...ticket, path: "foreign" })).rejects.toThrow();
});
it("concurrent duplicate completion produces one source and one original event", async () => {
  const results = await Promise.all([
    independentUploadReceipt(ticket, content),
    independentUploadReceipt(ticket, content),
  ]);
  expect(results).toEqual([{ id: ticket.sourceId }, { id: ticket.sourceId }]);
  expect((await pg.query("select * from artist_activity_events")).rows).toHaveLength(1);
});
it("receipt failure rolls back the source and permits a clean retry", async () => {
  await pg.exec(
    "alter table artist_activity_events add constraint reject_fixture check(false) not valid",
  );
  try {
    await expect(independentUploadReceipt(ticket, content)).rejects.toThrow();
    expect((await pg.query("select * from artist_vault_sources")).rows).toHaveLength(0);
  } finally {
    await pg.exec("alter table artist_activity_events drop constraint reject_fixture");
  }
  expect(await independentUploadReceipt(ticket, content)).toEqual({ id: ticket.sourceId });
});
