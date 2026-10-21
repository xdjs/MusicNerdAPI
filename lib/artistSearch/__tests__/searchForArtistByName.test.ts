import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (q: SQL) => execute(q) } }));
const { searchForArtistByName } = await import("@/lib/artistSearch/searchForArtistByName");

const render = (q: SQL) => new PgDialect().sqlToQuery(q);
beforeEach(() => vi.clearAllMocks());

describe("searchForArtistByName", () => {
  it("returns the rows in one query", async () => {
    execute.mockResolvedValueOnce([{ id: "a1", name: "Pete Rango" }]);
    expect(await searchForArtistByName("Pete Rango")).toEqual([{ id: "a1", name: "Pete Rango" }]);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("matches spaced and legacy compact names before the result limit", async () => {
    execute.mockResolvedValue([]);
    await searchForArtistByName("Pete Ra");
    const { sql, params } = render(execute.mock.calls[0][0]);
    expect(params).toContain("pete ra");
    expect(params).toContain("petera");
    const whereClause = sql.split("WHERE")[1].split("ORDER BY")[0];
    expect(whereClause).toMatch(/lcname LIKE.*OR lcname LIKE/s);
    expect(sql).toMatch(/CASE WHEN \(lcname LIKE.*OR lcname LIKE.*THEN 0 ELSE 1/s);
    expect(sql).toContain("COALESCE(NULLIF(POSITION(");
    expect(sql).toContain("LIMIT 10");
    expect(sql).toMatch(/lcname %/);
  });

  it("does not add a broad empty compact pattern for whitespace-only searches", async () => {
    execute.mockResolvedValue([]);
    await searchForArtistByName("   ");
    expect(render(execute.mock.calls[0][0]).params).not.toContain("");
  });

  it("selects custom_image aliased to customImage, so the row carries the camelCase field", async () => {
    execute.mockResolvedValue([]);
    await searchForArtistByName("anything");
    expect(render(execute.mock.calls[0][0]).sql.replace(/\s+/g, " ")).toContain(
      'custom_image AS "customImage"',
    );
  });

  it("wraps a database error in MusicNerdWeb's message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValueOnce(new Error("pool"));
    await expect(searchForArtistByName("x")).rejects.toThrow("Error searching for artist by name");
    error.mockRestore();
  });
});
