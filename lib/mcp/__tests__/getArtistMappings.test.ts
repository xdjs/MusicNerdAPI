import { describe, it, expect, vi, beforeEach } from "vitest";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(async (_o: unknown): Promise<unknown[]> => []),
  findFirst: vi.fn(async (_o: unknown): Promise<unknown> => undefined),
}));
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistIdMappings: { findMany }, artists: { findFirst } } },
}));
const { getArtistMappings } = await import("@/lib/mcp/getArtistMappings");

beforeEach(() => vi.clearAllMocks());

describe("getArtistMappings", () => {
  it("selects the artist's mappings by platform with the public columns, without checking the artist", async () => {
    const rows = [
      {
        id: "m1",
        platform: "deezer",
        platformId: "1",
        confidence: "high",
        source: "wikidata",
        reasoning: null,
        resolvedAt: "t",
      },
    ];
    findMany.mockResolvedValue(rows);
    expect(await getArtistMappings("a1")).toBe(rows);
    const options = findMany.mock.calls[0][0] as {
      where: unknown;
      orderBy: unknown[];
      columns: unknown;
    };
    expect(options.where).toBeDefined();
    expect(options.orderBy).toHaveLength(1);
    expect(options.columns).toEqual({
      id: true,
      platform: true,
      platformId: true,
      confidence: true,
      source: true,
      reasoning: true,
      resolvedAt: true,
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("on an empty result, returns [] for a known artist and throws for an unknown one", async () => {
    findMany.mockResolvedValue([]);
    findFirst.mockResolvedValueOnce({ id: "a1" });
    expect(await getArtistMappings("a1")).toEqual([]);
    expect(findFirst.mock.calls[0][0]).toMatchObject({ columns: { id: true } });
    findFirst.mockResolvedValueOnce(undefined);
    await expect(getArtistMappings("a2")).rejects.toThrow(
      new MappingNotFoundError("Artist not found: a2"),
    );
  });
});
