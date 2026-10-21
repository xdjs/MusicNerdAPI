import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { getMappingExclusions } = vi.hoisted(() => ({
  getMappingExclusions: vi.fn(async (_p: string, _l?: number): Promise<any> => ({
    exclusions: [],
    total: 0,
  })),
}));
vi.mock("@/lib/mcp/getMappingExclusions", () => ({ getMappingExclusions }));
const { registerGetMappingExclusionsTool } =
  await import("@/lib/mcp/registerGetMappingExclusionsTool");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("get_mapping_exclusions", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerGetMappingExclusionsTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["get_mapping_exclusions"]);
    expect(tool.title).toBe("Get Mapping Exclusions");
    expect(tool.description).toBe(
      "List artists that have been excluded from mapping for a given platform. Useful for reviewing skipped artists. Clearing exclusions requires direct database access.",
    );
  });

  it("returns the exclusions with the platform and total, passing the limit through", async () => {
    const exclusions = [
      {
        id: "e1",
        artistId: "a1",
        artistName: "A",
        spotify: "s",
        platform: "deezer",
        reason: "conflict",
        details: null,
        createdAt: "t",
      },
    ];
    getMappingExclusions.mockResolvedValue({ exclusions, total: 7 });
    const { result, parsed } = await callTool(registerGetMappingExclusionsTool(testServer()), {
      platform: "deezer",
      limit: 25,
    });
    expect(getMappingExclusions).toHaveBeenCalledWith("deezer", 25);
    expect(parsed).toEqual({ platform: "deezer", exclusions, total: 7 });
    expect(result.isError).toBeUndefined();
  });

  it("is INVALID_INPUT for a bad platform and INTERNAL_ERROR otherwise", async () => {
    const tool = registerGetMappingExclusionsTool(testServer());
    getMappingExclusions.mockRejectedValueOnce(
      new MappingValidationError("Invalid platform: nope"),
    );
    const bad = await callTool(tool, { platform: "nope", limit: 10 });
    expect(bad.parsed).toEqual({ error: "Invalid platform: nope", code: "INVALID_INPUT" });
    expect(bad.result.isError).toBe(true);
    getMappingExclusions.mockRejectedValueOnce(new Error("db"));
    const { result, parsed } = await callTool(tool, { platform: "deezer", limit: 10 });
    expect(parsed).toEqual({ error: "Failed to get mapping exclusions", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
