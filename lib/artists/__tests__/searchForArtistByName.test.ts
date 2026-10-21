import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async (_q: unknown): Promise<unknown[]> => []),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { searchForArtistByName } = await import("@/lib/artists/searchForArtistByName");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("searchForArtistByName", () => {
  it("sets the trigram threshold, then selects with both lcname forms when the name has spaces, ten at most", async () => {
    const rows = [{ id: "a1", name: "Pete Rango" }];
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);
    expect(await searchForArtistByName("Pete Rango")).toEqual(rows);
    expect(renderSql(execute.mock.calls[0][0] as never).text).toBe(
      "SET LOCAL pg_trgm.similarity_threshold = 0.3;",
    );
    const { text, params } = renderSql(execute.mock.calls[1][0] as never);
    expect(text).toContain("(lcname LIKE '%' || $1 || '%' OR lcname LIKE '%' || $2 || '%')");
    expect(text).toContain("COALESCE(NULLIF(POSITION($");
    expect(text).toContain("LIMIT 10;");
    expect(text).toContain('custom_image AS "customImage"');
    expect(params.slice(0, 2)).toEqual(["pete rango", "peterango"]);
  });

  it("uses the single lcname form for a one-word name and normalises accents and punctuation", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await searchForArtistByName("AC/DC");
    const { text, params } = renderSql(execute.mock.calls[1][0] as never);
    expect(text).toContain("WHERE lcname LIKE '%' || $2 || '%' OR lcname % $3");
    expect(text).not.toContain("COALESCE(NULLIF");
    expect(params[0]).toBe("acdc");
  });

  it("wraps a database failure", async () => {
    execute.mockRejectedValueOnce(new Error("boom"));
    await expect(searchForArtistByName("x")).rejects.toThrow("Error searching for artist by name");
  });
});
