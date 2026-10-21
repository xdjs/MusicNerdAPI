import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";

const { getArtistMappings } = vi.hoisted(() => ({
  getArtistMappings: vi.fn(async (_a: string): Promise<any[]> => []),
}));
vi.mock("@/lib/mcp/getArtistMappings", () => ({ getArtistMappings }));
const { registerGetArtistMappingsTool } = await import("@/lib/mcp/registerGetArtistMappingsTool");

const artistId = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("get_artist_mappings", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerGetArtistMappingsTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["get_artist_mappings"]);
    expect(tool.title).toBe("Get Artist Mappings");
    expect(tool.description).toBe("Get all cross-platform ID mappings for a specific artist.");
  });

  it("returns the mappings with the artist id and count", async () => {
    const mappings = [
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
    getArtistMappings.mockResolvedValue(mappings);
    const { result, parsed } = await callTool(registerGetArtistMappingsTool(testServer()), {
      artistId,
    });
    expect(getArtistMappings).toHaveBeenCalledWith(artistId);
    expect(parsed).toEqual({ artistId, mappings, totalMappings: 1 });
    expect(result.isError).toBeUndefined();
  });

  it("is NOT_FOUND for an unknown artist and INTERNAL_ERROR otherwise", async () => {
    const tool = registerGetArtistMappingsTool(testServer());
    getArtistMappings.mockRejectedValueOnce(
      new MappingNotFoundError(`Artist not found: ${artistId}`),
    );
    const nf = await callTool(tool, { artistId });
    expect(nf.parsed).toEqual({ error: "Artist not found", code: "NOT_FOUND" });
    expect(nf.result.isError).toBe(true);
    getArtistMappings.mockRejectedValueOnce(new Error("db"));
    const { result, parsed } = await callTool(tool, { artistId });
    expect(parsed).toEqual({ error: "Failed to get artist mappings", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
