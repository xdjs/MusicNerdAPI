import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";

const { excludeArtistMapping, excludeArtistMappingBatch, logMcpAudit, requireMcpAuth } = vi.hoisted(
  () => ({
    excludeArtistMapping: vi.fn(async (_p: unknown): Promise<any> => ({
      created: true,
      updated: false,
    })),
    excludeArtistMappingBatch: vi.fn(async (_i: unknown, _h: string): Promise<any> => ({
      results: [],
    })),
    logMcpAudit: vi.fn(async (_e: unknown) => {}),
    requireMcpAuth: vi.fn((): string => "test-hash"),
  }),
);
vi.mock("@/lib/mcp/excludeArtistMapping", () => ({ excludeArtistMapping }));
vi.mock("@/lib/mcp/excludeArtistMappingBatch", () => ({ excludeArtistMappingBatch }));
vi.mock("@/lib/mcp/logMcpAudit", () => ({ logMcpAudit }));
vi.mock("@/lib/mcpAuth/requireMcpAuth", () => ({ requireMcpAuth }));
const { registerExcludeArtistMappingTool } =
  await import("@/lib/mcp/registerExcludeArtistMappingTool");

const validArgs = {
  artistId: "00000000-0000-0000-0000-000000000001",
  platform: "deezer",
  reason: "name_mismatch",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireMcpAuth.mockReturnValue("test-hash");
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

  it("is AUTH_REQUIRED without auth, before any write", async () => {
    requireMcpAuth.mockImplementation(() => {
      throw new McpAuthError("Authentication required");
    });
    const { result, parsed } = await callTool(
      registerExcludeArtistMappingTool(testServer()),
      validArgs,
    );
    expect(parsed).toEqual({ error: "Authentication required", code: "AUTH_REQUIRED" });
    expect(result.isError).toBe(true);
    expect(excludeArtistMapping).not.toHaveBeenCalled();
  });

  it("excludes with the key's hash, audits reason and details, and reports success", async () => {
    const { result, parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), {
      ...validArgs,
      details: "MusicNerd 'A' vs Deezer 'B'",
    });
    expect(excludeArtistMapping).toHaveBeenCalledWith({
      ...validArgs,
      details: "MusicNerd 'A' vs Deezer 'B'",
      apiKeyHash: "test-hash",
    });
    expect(parsed).toEqual({ success: true, created: true, updated: false });
    expect(result.isError).toBeUndefined();
    expect(logMcpAudit).toHaveBeenCalledWith({
      artistId: validArgs.artistId,
      field: "mapping:deezer",
      action: "exclude",
      newValue: "name_mismatch: MusicNerd 'A' vs Deezer 'B'",
      apiKeyHash: "test-hash",
    });
  });

  it("audits the bare reason when there are no details", async () => {
    await callTool(registerExcludeArtistMappingTool(testServer()), validArgs);
    expect(logMcpAudit).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: "name_mismatch" }),
    );
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
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("still succeeds when the audit log fails", async () => {
    logMcpAudit.mockRejectedValue(new Error("DB connection failed"));
    const { parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), validArgs);
    expect(parsed.success).toBe(true);
  });

  it("processes a batch through items and audits only the stored ones, in one insert", async () => {
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
    expect(excludeArtistMappingBatch).toHaveBeenCalledWith(items, "test-hash");
    expect(excludeArtistMapping).not.toHaveBeenCalled();
    expect(parsed.success).toBe(true);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[1].error).toBe("Artist not found");
    expect(result.isError).toBeUndefined();
    expect(logMcpAudit).toHaveBeenCalledTimes(1);
    expect(logMcpAudit).toHaveBeenCalledWith([
      {
        artistId: "00000000-0000-0000-0000-000000000001",
        field: "mapping:deezer",
        action: "exclude",
        newValue: "name_mismatch: d1",
        apiKeyHash: "test-hash",
      },
    ]);
  });

  it("handles an empty batch without auditing", async () => {
    excludeArtistMappingBatch.mockResolvedValue({ results: [] });
    const { parsed } = await callTool(registerExcludeArtistMappingTool(testServer()), {
      items: [],
    });
    expect(parsed).toEqual({ success: true, results: [] });
    expect(logMcpAudit).not.toHaveBeenCalled();
  });
});
