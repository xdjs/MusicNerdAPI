import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";

const { getMappingStats } = vi.hoisted(() => ({
  getMappingStats: vi.fn(async (): Promise<any> => ({})),
}));
vi.mock("@/lib/mcp/getMappingStats", () => ({ getMappingStats }));
const { registerGetMappingStatsTool } = await import("@/lib/mcp/registerGetMappingStatsTool");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("get_mapping_stats", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerGetMappingStatsTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["get_mapping_stats"]);
    expect(tool.title).toBe("Get Mapping Stats");
    expect(tool.description).toBe(
      "Get statistics about cross-platform artist ID mapping coverage across all platforms.",
    );
  });

  it("returns the stats object as-is", async () => {
    const stats = {
      totalArtistsWithSpotify: 100,
      totalArtistsWithDeezer: 20,
      platformStats: [{ platform: "deezer", mappedCount: 10, percentage: 10 }],
    };
    getMappingStats.mockResolvedValue(stats);
    const { result, parsed } = await callTool(registerGetMappingStatsTool(testServer()), {});
    expect(parsed).toEqual(stats);
    expect(result.isError).toBeUndefined();
  });

  it("is INTERNAL_ERROR when the query throws", async () => {
    getMappingStats.mockRejectedValue(new Error("db"));
    const { result, parsed } = await callTool(registerGetMappingStatsTool(testServer()), {});
    expect(parsed).toEqual({ error: "Failed to get mapping stats", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
