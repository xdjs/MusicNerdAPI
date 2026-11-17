import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertLocalTestUrl } from "./fixtures/assertLocalTestUrl";

describe("assertLocalTestUrl", () => {
  it("accepts localhost and 127.0.0.1", async () => {
    await expect(assertLocalTestUrl("postgres://u:p@localhost:5432/postgres")).resolves.toBe(
      undefined,
    );
    await expect(assertLocalTestUrl("postgres://u:p@127.0.0.1:54329/postgres")).resolves.toBe(
      undefined,
    );
  });

  it("rejects a remote host", async () => {
    await expect(assertLocalTestUrl("postgres://u:p@db.example.com/postgres")).rejects.toThrow(
      /must point at localhost or 127\.0\.0\.1.*db\.example\.com/,
    );
  });

  it("rejects a local hostname that names a remote host in its options", async () => {
    await expect(
      assertLocalTestUrl("postgres://u:p@localhost/postgres?host=db.example.com"),
    ).rejects.toThrow(/db\.example\.com/);
    await expect(
      assertLocalTestUrl("postgres://u:p@localhost/postgres?hostaddr=10.0.0.5"),
    ).rejects.toThrow(/10\.0\.0\.5/);
  });

  it("rejects a remote host listed after a local one", async () => {
    await expect(
      assertLocalTestUrl("postgres://u:p@localhost,db.example.com:5433/postgres"),
    ).rejects.toThrow(/db\.example\.com/);
  });
});

describe("the vendored 0066 source_units fixture", () => {
  const fixture = readFileSync(
    new URL("./fixtures/source-units-0066.sql", import.meta.url),
    "utf8",
  );

  it("names the migration it must track", () => {
    expect(fixture).toMatch(/drizzle\/0066_source_units\.sql/);
  });

  it("holds the five source_units statements and nothing that needs the Web schema", () => {
    const statements = fixture
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(s => !s.split("\n").every(line => line.startsWith("--") || !line.trim()));
    expect(statements.map(s => s.split("(")[0].trim())).toEqual([
      'CREATE TABLE "source_units"',
      'ALTER TABLE "source_units" ADD CONSTRAINT "source_units_artist_id_artists_id_fk" FOREIGN KEY',
      'CREATE INDEX "source_units_artist" ON "source_units" USING btree',
      'CREATE INDEX "source_units_search" ON "source_units" USING gin',
      'CREATE INDEX "source_units_embedding" ON "source_units" USING hnsw',
    ]);
  });
});
