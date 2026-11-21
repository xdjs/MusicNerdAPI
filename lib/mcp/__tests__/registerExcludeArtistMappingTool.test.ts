import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { excludeArtistMapping, excludeArtistMappingBatch } = vi.hoisted(() => ({
  excludeArtistMapping: vi.fn(async (_p: unknown): Promise<any> => ({
    created: true,
    updated: false,
  })),
  excludeArtistMappingBatch: vi.fn(async (_i: unknown, _h: string): Promise<any> => ({
    results: [],
  })),
}));
vi.mock("@/lib/mcp/excludeArtistMapping", () => ({ excludeArtistMapping }));
vi.mock("@/lib/mcp/excludeArtistMappingBatch", () => ({ excludeArtistMappingBatch }));
const { registerExcludeArtistMappingTool } =
  await import("@/lib/mcp/registerExcludeArtistMappingTool");

const validArgs = {
  artistId: "00000000-0000-0000-0000-000000000001",
  platform: "deezer",
  reason: "name_mismatch",
};

beforeEach(() => {
  vi.clearAllMocks();
  excludeArtistMapping.mockResolvedValue({ created: true, updated: false });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("exclude_artist_mapping", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerExcludeArtistMappingTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["exclude_artist_mapping"]);
    expect(tool.title).toBe("Exclude Artist Mapping");
    expect(tool.description).toBe(
      "Mark artist(s) as excluded from future mapping batches for a given platform. For a single item, provide the fields directly. For batch mode, provide an 'items' array instead. Each batch item is processed independently — partial failures do not roll back successful items.",
    );
  });

  it("excludes and reports success", async () => {
    const { result, parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), {
      ...validArgs,
      details: "MusicNerd 'A' vs Deezer 'B'",
    });
    expect(excludeArtistMapping).toHaveBeenCalledWith({
      ...validArgs,
      details: "MusicNerd 'A' vs Deezer 'B'",
    });
    expect(parsed).toEqual({ success: true, created: true, updated: false });
    expect(result.isError).toBeUndefined();
  });

  it("is INVALID_INPUT for missing fields, without writing", async () => {
    const { result, parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), {
      ...validArgs,
      reason: undefined,
    });
    expect(parsed).toEqual({
      error: "Missing required fields: artistId, platform, reason",
      code: "INVALID_INPUT",
    });
    expect(result.isError).toBe(true);
    expect(excludeArtistMapping).not.toHaveBeenCalled();
  });

  it("maps the service's errors: NOT_FOUND, INVALID_INPUT, INTERNAL_ERROR", async () => {
    const tool = registerExcludeArtistMappingTool(testServer());
    excludeArtistMapping.mockRejectedValueOnce(new MappingNotFoundError("Artist not found: x"));
    expect((await callTool(tool, validArgs)).parsed).toEqual({
      error: "Artist not found",
      code: "NOT_FOUND",
    });
    excludeArtistMapping.mockRejectedValueOnce(
      new MappingValidationError("Invalid platform: nope"),
    );
    expect((await callTool(tool, { ...validArgs, platform: "nope" })).parsed).toEqual({
      error: "Invalid platform: nope",
      code: "INVALID_INPUT",
    });
    excludeArtistMapping.mockRejectedValueOnce(new Error("db"));
    const { result, parsed } = await callTool(tool, validArgs);
    expect(parsed).toEqual({ error: "Failed to exclude artist mapping", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });

  it("processes a batch through items", async () => {
    excludeArtistMappingBatch.mockResolvedValue({
      results: [
        { artistId: "00000000-0000-0000-0000-000000000001", created: true, updated: false },
        {
          artistId: "00000000-0000-0000-0000-000000000002",
          created: false,
          updated: false,
          error: "Artist not found",
        },
      ],
    });
    const items = [
      { ...validArgs, details: "d1" },
      { ...validArgs, artistId: "00000000-0000-0000-0000-000000000002", reason: "conflict" },
    ];
    const { result, parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), {
      items,
    });
    expect(excludeArtistMappingBatch).toHaveBeenCalledWith(items);
    expect(excludeArtistMapping).not.toHaveBeenCalled();
    expect(parsed.success).toBe(true);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[1].error).toBe("Artist not found");
    expect(result.isError).toBeUndefined();
  });

  it("handles an empty batch", async () => {
    excludeArtistMappingBatch.mockResolvedValue({ results: [] });
    const { parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), {
      items: [],
    });
    expect(parsed).toEqual({ success: true, results: [] });
  });
});
