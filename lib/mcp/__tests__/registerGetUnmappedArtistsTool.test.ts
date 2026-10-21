import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { getUnmappedArtists } = vi.hoisted(() => ({
  getUnmappedArtists: vi.fn(
    async (_p: string, _l: number, _o: number, _b: string): Promise<any> => ({
      artists: [],
      totalUnmapped: 0,
    }),
  ),
}));
vi.mock("@/lib/mcp/getUnmappedArtists", () => ({ getUnmappedArtists }));
const { registerGetUnmappedArtistsTool } = await import("@/lib/mcp/registerGetUnmappedArtistsTool");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("get_unmapped_artists", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerGetUnmappedArtistsTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["get_unmapped_artists"]);
    expect(tool.title).toBe("Get Unmapped Artists");
    expect(tool.description).toBe(
      "Get artists that have a platform ID but no mapping for a given target platform. Use basePlatform to select the source (default: spotify, use 'deezer' for Deezer-primary workflows).",
    );
  });

  it("returns the page with its platform, total, limit and offset", async () => {
    getUnmappedArtists.mockResolvedValue({
      artists: [{ id: "a1", name: "Test Artist", spotify: "sp1", deezer: null }],
      totalUnmapped: 42,
    });
    const { result, parsed } = await callTool(registerGetUnmappedArtistsTool(testServer()), {
      platform: "deezer",
      limit: 10,
      offset: 0,
    });
    expect(parsed).toEqual({
      platform: "deezer",
      artists: [{ id: "a1", name: "Test Artist", spotify: "sp1", deezer: null }],
      totalUnmapped: 42,
      limit: 10,
      offset: 0,
    });
    expect(result.isError).toBeUndefined();
  });

  it("passes pagination through and defaults basePlatform to spotify", async () => {
    getUnmappedArtists.mockResolvedValue({ artists: [], totalUnmapped: 100 });
    const { parsed } = await callTool(registerGetUnmappedArtistsTool(testServer()), {
      platform: "deezer",
      limit: 25,
      offset: 50,
    });
    expect(getUnmappedArtists).toHaveBeenCalledWith("deezer", 25, 50, "spotify");
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(50);
  });

  it("clamps limit to 1..200 and offset to >= 0, defaulting to 50 and 0", async () => {
    const tool = registerGetUnmappedArtistsTool(testServer());
    await callTool(tool, { platform: "deezer", limit: 500, offset: 0 });
    expect(getUnmappedArtists).toHaveBeenLastCalledWith("deezer", 200, 0, "spotify");
    await callTool(tool, { platform: "deezer", limit: 0, offset: -5 });
    expect(getUnmappedArtists).toHaveBeenLastCalledWith("deezer", 1, 0, "spotify");
    await callTool(tool, { platform: "deezer" });
    expect(getUnmappedArtists).toHaveBeenLastCalledWith("deezer", 50, 0, "spotify");
  });

  it("passes basePlatform deezer through", async () => {
    getUnmappedArtists.mockResolvedValue({
      artists: [{ id: "a1", name: "Test", spotify: null, deezer: "11600" }],
      totalUnmapped: 1,
    });
    const { parsed } = await callTool(registerGetUnmappedArtistsTool(testServer()), {
      platform: "apple_music",
      limit: 10,
      offset: 0,
      basePlatform: "deezer",
    });
    expect(getUnmappedArtists).toHaveBeenCalledWith("apple_music", 10, 0, "deezer");
    expect(parsed.artists[0].deezer).toBe("11600");
  });

  it("is INVALID_INPUT for a bad platform and INTERNAL_ERROR otherwise", async () => {
    const tool = registerGetUnmappedArtistsTool(testServer());
    getUnmappedArtists.mockRejectedValueOnce(
      new MappingValidationError("Invalid platform: invalid_platform"),
    );
    const bad = await callTool(tool, { platform: "invalid_platform", limit: 10, offset: 0 });
    expect(bad.parsed).toEqual({
      error: "Invalid platform: invalid_platform",
      code: "INVALID_INPUT",
    });
    expect(bad.result.isError).toBe(true);
    getUnmappedArtists.mockRejectedValueOnce(new Error("db"));
    const { result, parsed } = await callTool(tool, { platform: "deezer", limit: 10, offset: 0 });
    expect(parsed).toEqual({ error: "Failed to get unmapped artists", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
