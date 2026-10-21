import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { MappingConcurrentWriteError } from "@/lib/mcp/MappingConcurrentWriteError";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";

const { resolveArtistMapping, resolveArtistMappingBatch, logMcpAudit, requireMcpAuth } = vi.hoisted(
  () => ({
    resolveArtistMapping: vi.fn(async (_p: unknown): Promise<any> => ({
      created: true,
      updated: false,
      skipped: false,
    })),
    resolveArtistMappingBatch: vi.fn(async (_i: unknown, _h: string): Promise<any> => ({
      results: [],
    })),
    logMcpAudit: vi.fn(async (_e: unknown) => {}),
    requireMcpAuth: vi.fn((): string => "test-hash"),
  }),
);
vi.mock("@/lib/mcp/resolveArtistMapping", () => ({ resolveArtistMapping }));
vi.mock("@/lib/mcp/resolveArtistMappingBatch", () => ({ resolveArtistMappingBatch }));
vi.mock("@/lib/mcp/logMcpAudit", () => ({ logMcpAudit }));
vi.mock("@/lib/mcpAuth/requireMcpAuth", () => ({ requireMcpAuth }));
const { registerResolveArtistIdTool } = await import("@/lib/mcp/registerResolveArtistIdTool");

const validArgs = {
  artistId: "00000000-0000-0000-0000-000000000001",
  platform: "deezer",
  platformId: "12345",
  confidence: "high",
  source: "wikidata",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireMcpAuth.mockReturnValue("test-hash");
  resolveArtistMapping.mockResolvedValue({ created: true, updated: false, skipped: false });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("resolve_artist_id", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerResolveArtistIdTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["resolve_artist_id"]);
    expect(tool.title).toBe("Resolve Artist ID");
    expect(tool.description).toBe(
      "Store cross-platform ID mapping(s) for artist(s). For a single item, provide the fields directly. For batch mode, provide an 'items' array instead. Each batch item is processed independently — partial failures do not roll back successful items.",
    );
  });

  it("is AUTH_REQUIRED without auth, before any write", async () => {
    requireMcpAuth.mockImplementation(() => {
      throw new McpAuthError("Authentication required");
    });
    const { result, parsed } = await callTool(registerResolveArtistIdTool(testServer()), validArgs);
    expect(parsed).toEqual({ error: "Authentication required", code: "AUTH_REQUIRED" });
    expect(result.isError).toBe(true);
    expect(resolveArtistMapping).not.toHaveBeenCalled();
  });

  it("creates a mapping with the key's hash and reports success", async () => {
    const { result, parsed } = await callTool(registerResolveArtistIdTool(testServer()), {
      ...validArgs,
      reasoning: "why",
    });
    expect(resolveArtistMapping).toHaveBeenCalledWith({
      ...validArgs,
      reasoning: "why",
      apiKeyHash: "test-hash",
    });
    expect(parsed).toEqual({ success: true, created: true, updated: false, skipped: false });
    expect(result.isError).toBeUndefined();
  });

  it("is INVALID_INPUT for missing fields (an empty platformId included) or a bad platform, without writing", async () => {
    const tool = registerResolveArtistIdTool(testServer());
    expect((await callTool(tool, { ...validArgs, source: undefined })).parsed).toEqual({
      error: "Missing required fields: artistId, platform, platformId, confidence, source",
      code: "INVALID_INPUT",
    });
    expect((await callTool(tool, { ...validArgs, platformId: "" })).parsed).toEqual({
      error: "Missing required fields: artistId, platform, platformId, confidence, source",
      code: "INVALID_INPUT",
    });
    const bad = await callTool(tool, { ...validArgs, platform: "badplatform" });
    expect(bad.parsed.code).toBe("INVALID_INPUT");
    expect(bad.parsed.error).toMatch(/^Invalid platform\. Valid platforms: deezer, apple_music/);
    expect(bad.result.isError).toBe(true);
    expect(resolveArtistMapping).not.toHaveBeenCalled();
  });

  it("maps the service's errors: NOT_FOUND, INVALID_INPUT, CONFLICT, INTERNAL_ERROR", async () => {
    const tool = registerResolveArtistIdTool(testServer());
    resolveArtistMapping.mockRejectedValueOnce(new MappingNotFoundError("Artist not found: x"));
    expect((await callTool(tool, validArgs)).parsed).toEqual({
      error: "Artist not found",
      code: "NOT_FOUND",
    });
    resolveArtistMapping.mockRejectedValueOnce(
      new MappingValidationError("platformId cannot be empty"),
    );
    expect((await callTool(tool, { ...validArgs, platformId: " " })).parsed).toEqual({
      error: "platformId cannot be empty",
      code: "INVALID_INPUT",
    });
    resolveArtistMapping.mockRejectedValueOnce(
      new MappingConflictError(
        "platformId 12345 on deezer is already mapped to a different artist",
      ),
    );
    expect((await callTool(tool, validArgs)).parsed).toEqual({
      error: "platformId 12345 on deezer is already mapped to a different artist",
      code: "CONFLICT",
    });
    resolveArtistMapping.mockRejectedValueOnce(new Error("db"));
    const { result, parsed } = await callTool(tool, validArgs);
    expect(parsed).toEqual({ error: "Failed to resolve artist ID", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });

  it("reports a concurrent write as a skipped success", async () => {
    resolveArtistMapping.mockRejectedValue(new MappingConcurrentWriteError("concurrent write"));
    const { result, parsed } = await callTool(registerResolveArtistIdTool(testServer()), validArgs);
    expect(parsed).toEqual({
      success: true,
      created: false,
      updated: false,
      skipped: true,
      reason: "concurrent_write",
    });
    expect(result.isError).toBeUndefined();
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("reports an update with the previous mapping and audits it with exact fields", async () => {
    resolveArtistMapping.mockResolvedValue({
      created: false,
      updated: true,
      skipped: false,
      previousMapping: { platformId: "old-id", confidence: "medium" },
    });
    const { parsed } = await callTool(registerResolveArtistIdTool(testServer()), validArgs);
    expect(parsed.success).toBe(true);
    expect(parsed.updated).toBe(true);
    expect(parsed.previousMapping).toEqual({ platformId: "old-id", confidence: "medium" });
    expect(logMcpAudit).toHaveBeenCalledWith({
      artistId: validArgs.artistId,
      field: "mapping:deezer",
      action: "resolve",
      oldValue: "old-id",
      newValue: "12345",
      apiKeyHash: "test-hash",
    });
  });

  it("audits a creation with a null old value", async () => {
    await callTool(registerResolveArtistIdTool(testServer()), validArgs);
    expect(logMcpAudit).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: null, newValue: "12345" }),
    );
  });

  it("does not audit a skipped mapping", async () => {
    resolveArtistMapping.mockResolvedValue({
      created: false,
      updated: false,
      skipped: true,
      previousMapping: { platformId: "existing-id", confidence: "manual" },
    });
    const { parsed } = await callTool(registerResolveArtistIdTool(testServer()), validArgs);
    expect(parsed.success).toBe(true);
    expect(parsed.skipped).toBe(true);
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("still succeeds when the audit log fails", async () => {
    logMcpAudit.mockRejectedValue(new Error("DB connection failed"));
    const { parsed } = await callTool(registerResolveArtistIdTool(testServer()), validArgs);
    expect(parsed.success).toBe(true);
  });

  it("processes a batch through items, returning per-item results and errors", async () => {
    resolveArtistMappingBatch.mockResolvedValue({
      results: [
        {
          artistId: "00000000-0000-0000-0000-000000000001",
          created: true,
          updated: false,
          skipped: false,
        },
        {
          artistId: "00000000-0000-0000-0000-000000000002",
          created: false,
          updated: false,
          skipped: false,
          error: "Artist not found: 00000000-0000-0000-0000-000000000002",
        },
      ],
    });
    const items = [
      { ...validArgs },
      { ...validArgs, artistId: "00000000-0000-0000-0000-000000000002", platformId: "67890" },
    ];
    const { result, parsed } = await callTool(registerResolveArtistIdTool(testServer()), { items });
    expect(resolveArtistMappingBatch).toHaveBeenCalledWith(items, "test-hash");
    expect(resolveArtistMapping).not.toHaveBeenCalled();
    expect(parsed.success).toBe(true);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0].error).toBeUndefined();
    expect(parsed.results[1].error).toContain("Artist not found");
    expect(result.isError).toBeUndefined();
  });

  it("handles an empty batch without auditing", async () => {
    resolveArtistMappingBatch.mockResolvedValue({ results: [] });
    const { result, parsed } = await callTool(registerResolveArtistIdTool(testServer()), {
      items: [],
    });
    expect(parsed).toEqual({ success: true, results: [] });
    expect(result.isError).toBeUndefined();
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("audits only the batch items that were stored, in one insert", async () => {
    resolveArtistMappingBatch.mockResolvedValue({
      results: [
        {
          artistId: "00000000-0000-0000-0000-000000000001",
          created: false,
          updated: true,
          skipped: false,
          previousMapping: { platformId: "old", confidence: "low" },
        },
        {
          artistId: "00000000-0000-0000-0000-000000000002",
          created: false,
          updated: false,
          skipped: true,
        },
        {
          artistId: "00000000-0000-0000-0000-000000000003",
          created: false,
          updated: false,
          skipped: false,
          error: "Artist not found",
        },
      ],
    });
    const items = [
      { ...validArgs },
      { ...validArgs, artistId: "00000000-0000-0000-0000-000000000002", platformId: "67890" },
      { ...validArgs, artistId: "00000000-0000-0000-0000-000000000003", platformId: "99999" },
    ];
    await callTool(registerResolveArtistIdTool(testServer()), { items });
    expect(logMcpAudit).toHaveBeenCalledTimes(1);
    expect(logMcpAudit).toHaveBeenCalledWith([
      {
        artistId: "00000000-0000-0000-0000-000000000001",
        field: "mapping:deezer",
        action: "resolve",
        oldValue: "old",
        newValue: "12345",
        apiKeyHash: "test-hash",
      },
    ]);
  });

  it("still succeeds when the batch audit fails", async () => {
    resolveArtistMappingBatch.mockResolvedValue({
      results: [{ artistId: validArgs.artistId, created: true, updated: false, skipped: false }],
    });
    logMcpAudit.mockRejectedValue(new Error("DB connection failed"));
    const { parsed } = await callTool(registerResolveArtistIdTool(testServer()), {
      items: [validArgs],
    });
    expect(parsed.success).toBe(true);
  });
});
