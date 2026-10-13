import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const execute = vi.fn();
vi.mock("@/lib/db/db", () => ({ db: { execute: (q: SQL) => execute(q) } }));
const { searchArtistByName } = await import("@/lib/artistLookups/searchArtistByName");

const render = (q: SQL) => new PgDialect().sqlToQuery(q);
beforeEach(() => vi.clearAllMocks());

describe("searchArtistByName", () => {
  it("returns the best-ranked artist's X handle row", async () => {
    execute.mockResolvedValueOnce([{ x: "peterango" }]);
    expect(await searchArtistByName("Pete Rango")).toEqual({ x: "peterango" });
  });

  it("returns undefined when no artist matches", async () => {
    execute.mockResolvedValueOnce([]);
    expect(await searchArtistByName("zzzz")).toBeUndefined();
  });

  it("matches the normalised name and its space-less form, as the website does", async () => {
    execute.mockResolvedValueOnce([]);
    await searchArtistByName("Pete Rango");
    const { sql, params } = render(execute.mock.calls[0][0]);
    expect(params).toContain("pete rango");
    expect(params).toContain("peterango");
    expect(sql).toMatch(/lcname %/);
    expect(sql).toMatch(/similarity\(lcname/);
    expect(sql).toMatch(/limit 1/i);
  });

  it("uses one LIKE form when the name has no spaces", async () => {
    execute.mockResolvedValueOnce([]);
    await searchArtistByName("Drake");
    const { params } = render(execute.mock.calls[0][0]);
    expect(params.filter(p => p === "drake").length).toBeGreaterThan(0);
    expect(params).not.toContain("");
  });

  it("throws on a database error", async () => {
    execute.mockRejectedValueOnce(new Error("pool"));
    await expect(searchArtistByName("x")).rejects.toThrow("pool");
  });
});
