import { describe, it, expect, vi, beforeEach } from "vitest";

const { exclude } = vi.hoisted(() => ({
  exclude: vi.fn(async (_p: unknown): Promise<unknown> => ({})),
}));
vi.mock("@/lib/mcp/excludeArtistMapping", () => ({ excludeArtistMapping: exclude }));
const { excludeArtistMappingBatch } = await import("@/lib/mcp/excludeArtistMappingBatch");

const item = (artistId: string) => ({ artistId, platform: "deezer", reason: "conflict" as const });

beforeEach(() => vi.clearAllMocks());

describe("excludeArtistMappingBatch", () => {
  it("excludes each item with the key hash, in order, keeping failures on their item", async () => {
    exclude
      .mockResolvedValueOnce({ created: true, updated: false })
      .mockRejectedValueOnce(new Error("Artist not found: a2"))
      .mockResolvedValueOnce({ created: false, updated: true });
    const { results } = await excludeArtistMappingBatch(
      [item("a1"), { ...item("a2"), details: "d" }, item("a3")],
      "hash",
    );
    expect(results).toEqual([
      { artistId: "a1", created: true, updated: false },
      { artistId: "a2", created: false, updated: false, error: "Artist not found: a2" },
      { artistId: "a3", created: false, updated: true },
    ]);
    expect(exclude).toHaveBeenNthCalledWith(2, { ...item("a2"), details: "d", apiKeyHash: "hash" });
  });

  it("stringifies a non-Error failure and is empty for no items", async () => {
    exclude.mockRejectedValueOnce("nope");
    expect((await excludeArtistMappingBatch([item("a1")], "hash")).results[0].error).toBe("nope");
    expect(await excludeArtistMappingBatch([], "hash")).toEqual({ results: [] });
  });
});
