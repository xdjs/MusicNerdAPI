import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async (_q: unknown): Promise<unknown[]> => []),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getUnmappedArtists } = await import("@/lib/mcp/getUnmappedArtists");

beforeEach(() => vi.clearAllMocks());

describe("getUnmappedArtists", () => {
  it("refuses an unknown platform before touching the database", async () => {
    await expect(getUnmappedArtists("myspace", 10, 0)).rejects.toThrow(MappingValidationError);
    await expect(getUnmappedArtists("myspace", 10, 0)).rejects.toThrow("Invalid platform: myspace");
    expect(execute).not.toHaveBeenCalled();
  });

  it("counts and pages artists with a spotify id and no mapping or exclusion, daily-shuffled", async () => {
    execute
      .mockResolvedValueOnce([{ total: 42 }])
      .mockResolvedValueOnce([{ id: "a1", name: "A", spotify: "s1", deezer: null }]);
    const result = await getUnmappedArtists("deezer", 25, 50);
    expect(result).toEqual({
      artists: [{ id: "a1", name: "A", spotify: "s1", deezer: null }],
      totalUnmapped: 42,
    });
    const count = renderSql(execute.mock.calls[0][0] as never);
    expect(count.text).toContain(
      "SELECT COUNT(*)::int AS total FROM artists a WHERE a.spotify IS NOT NULL",
    );
    expect(count.text).toContain(
      "NOT EXISTS ( SELECT 1 FROM artist_id_mappings m WHERE m.artist_id = a.id AND m.platform = $1 )",
    );
    expect(count.text).toContain(
      "NOT EXISTS ( SELECT 1 FROM artist_mapping_exclusions e WHERE e.artist_id = a.id AND e.platform = $2 )",
    );
    expect(count.params).toEqual(["deezer", "deezer"]);
    const page = renderSql(execute.mock.calls[1][0] as never);
    expect(page.text).toContain(
      "SELECT a.id, a.name, a.spotify, a.deezer FROM artists a WHERE a.spotify IS NOT NULL",
    );
    expect(page.text).toContain(
      "NOT EXISTS ( SELECT 1 FROM artist_id_mappings m WHERE m.artist_id = a.id AND m.platform = $1 )",
    );
    expect(page.text).toContain(
      "NOT EXISTS ( SELECT 1 FROM artist_mapping_exclusions e WHERE e.artist_id = a.id AND e.platform = $2 )",
    );
    expect(page.text).toContain("ORDER BY MD5(a.id || CURRENT_DATE::text) LIMIT $3 OFFSET $4");
    expect(page.params).toEqual(["deezer", "deezer", 25, 50]);
  });

  it("requires a deezer id instead when basePlatform is deezer", async () => {
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await getUnmappedArtists("apple_music", 10, 0, "deezer")).toEqual({
      artists: [],
      totalUnmapped: 0,
    });
    expect(renderSql(execute.mock.calls[0][0] as never).text).toContain(
      "WHERE a.deezer IS NOT NULL",
    );
    expect(renderSql(execute.mock.calls[1][0] as never).text).toContain(
      "WHERE a.deezer IS NOT NULL",
    );
  });
});
