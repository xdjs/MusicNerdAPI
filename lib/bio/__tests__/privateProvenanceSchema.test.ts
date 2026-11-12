import { expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";
it("keeps provenance outside exposed artist and history rows", () => {
  expect(getTableColumns(schema.artists)).not.toHaveProperty("bioProvenance");
  expect(getTableColumns(schema.artistBioVersions)).not.toHaveProperty("bioProvenance");
  expect(schema).toHaveProperty("artistBioProvenance");
  expect(schema).toHaveProperty("artistBioVersionProvenance");
  const tables = schema as unknown as Record<string, typeof schema.artists>;
  expect(getTableConfig(tables.artistBioProvenance).schema).toBe("mn_private");
  expect(getTableConfig(tables.artistBioVersionProvenance).schema).toBe("mn_private");
  expect(getTableConfig(tables.artistBioProvenance).enableRLS).toBe(true);
  expect(getTableConfig(tables.artistBioVersionProvenance).enableRLS).toBe(true);
  expect(getTableConfig(tables.artistBioProvenance).checks.map(c => c.name)).toContain(
    "artist_bio_provenance_object",
  );
  expect(getTableConfig(tables.artistBioVersionProvenance).checks.map(c => c.name)).toContain(
    "artist_bio_version_provenance_object",
  );
});
