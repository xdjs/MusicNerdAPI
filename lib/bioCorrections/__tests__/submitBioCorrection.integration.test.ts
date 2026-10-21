import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import * as schema from "@/lib/db/schema";

const client = new PGlite();
const driver = drizzle(client, { schema });
const statements: string[] = [];
const database = {
  transaction: (fn: (tx: unknown) => Promise<unknown>) =>
    driver.transaction(tx =>
      fn({
        select: tx.select.bind(tx),
        insert: tx.insert.bind(tx),
        execute: async (q: SQL) => {
          statements.push(renderSql(q).text);
          return [];
        },
      }),
    ),
};
vi.mock("@/lib/db/db", () => ({
  get db() {
    return database;
  },
}));
const { submitBioCorrection: submit } = await import("@/lib/bioCorrections/submitBioCorrection");

const user = "00000000-0000-4000-8000-000000000001";
const artist = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  await client.exec(
    `create table artist_bio_corrections (id uuid primary key default gen_random_uuid(), artist_id uuid, user_id uuid, reason text, details text, source_url text, bio_snapshot text, status text default 'pending', created_at timestamptz default now(), reviewed_at timestamptz, reviewed_by uuid)`,
  );
}, 120_000);
afterAll(() => client.close());
beforeEach(async () => {
  statements.length = 0;
  await client.exec("truncate artist_bio_corrections");
});

it("serializes each account's reports with an advisory lock", async () => {
  await submit(
    user,
    artist,
    { reason: "other", details: "", sourceUrl: null, expectedBio: "A" },
    "A",
  );
  expect(statements).toEqual([
    expect.stringContaining("select pg_advisory_xact_lock(hashtextextended("),
  ]);
});

it("saves changed details, reason and source but deduplicates an exact repeat", async () => {
  const original = {
    reason: "other" as const,
    details: "Original QA report",
    sourceUrl: null,
    expectedBio: "Same About",
  };
  expect(await submit(user, artist, original, "Same About")).toBe("created");
  expect(
    await submit(user, artist, { ...original, details: "A different correction" }, "Same About"),
  ).toBe("created");
  const linked = { ...original, sourceUrl: "https://report-test.com/" };
  expect(await submit(user, artist, linked, "Same About")).toBe("created");
  expect(await submit(user, artist, { ...original, reason: "incorrect" }, "Same About")).toBe(
    "created",
  );
  expect(await submit(user, artist, linked, "Same About")).toBe("duplicate");
  expect(await submit(user, artist, original, "Same About")).toBe("duplicate");
  const result = await client.query("select details,source_url from artist_bio_corrections");
  expect(result.rows).toHaveLength(4);
  expect(result.rows).toContainEqual({
    details: "Original QA report",
    source_url: "https://report-test.com/",
  });
});

it("allows ten distinct reports, blocks the eleventh, and expires the rolling window", async () => {
  const input = { reason: "other" as const, details: "", sourceUrl: null, expectedBio: "About" };
  for (let i = 0; i < 10; i++)
    expect(await submit(user, artist, { ...input, details: `Report ${i}` }, "About")).toBe(
      "created",
    );
  expect(await submit(user, artist, { ...input, details: "Report 10" }, "About")).toBe("limited");
  expect(await submit(user, artist, { ...input, details: "Report 0" }, "About")).toBe("duplicate");
  await client.exec("update artist_bio_corrections set created_at=now()-interval '25 hours'");
  expect(await submit(user, artist, { ...input, details: "Report 10" }, "About")).toBe("created");
});
