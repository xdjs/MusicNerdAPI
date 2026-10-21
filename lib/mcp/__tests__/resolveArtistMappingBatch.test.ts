import { describe, it, expect, vi, beforeEach } from "vitest";

const { resolve } = vi.hoisted(() => ({
  resolve: vi.fn(async (_p: unknown): Promise<unknown> => ({})),
}));
vi.mock("@/lib/mcp/resolveArtistMapping", () => ({ resolveArtistMapping: resolve }));
const { resolveArtistMappingBatch } = await import("@/lib/mcp/resolveArtistMappingBatch");

const item = (artistId: string) => ({
  artistId,
  platform: "deezer",
  platformId: "1",
  confidence: "high" as const,
  source: "wikidata" as const,
});

beforeEach(() => vi.clearAllMocks());

describe("resolveArtistMappingBatch", () => {
  it("resolves each item with the key hash, in order, keeping failures on their item", async () => {
    resolve
      .mockResolvedValueOnce({ created: true, updated: false, skipped: false })
      .mockRejectedValueOnce(new Error("Artist not found: a2"))
      .mockResolvedValueOnce({
        created: false,
        updated: false,
        skipped: true,
        previousMapping: { platformId: "x", confidence: "manual" },
      });
    const { results } = await resolveArtistMappingBatch(
      [item("a1"), item("a2"), item("a3")],
      "hash",
    );
    expect(results).toEqual([
      { artistId: "a1", created: true, updated: false, skipped: false },
      {
        artistId: "a2",
        created: false,
        updated: false,
        skipped: false,
        error: "Artist not found: a2",
      },
      {
        artistId: "a3",
        created: false,
        updated: false,
        skipped: true,
        previousMapping: { platformId: "x", confidence: "manual" },
      },
    ]);
    expect(resolve).toHaveBeenCalledTimes(3);
    expect(resolve).toHaveBeenNthCalledWith(2, { ...item("a2"), apiKeyHash: "hash" });
  });

  it("stringifies a non-Error failure and is empty for no items", async () => {
    resolve.mockRejectedValueOnce("nope");
    expect((await resolveArtistMappingBatch([item("a1")], "hash")).results[0].error).toBe("nope");
    expect(await resolveArtistMappingBatch([], "hash")).toEqual({ results: [] });
  });
});
