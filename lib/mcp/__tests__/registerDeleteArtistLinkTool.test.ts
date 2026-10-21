import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";

const { clearArtistLink, logMcpAudit, requireMcpAuth } = vi.hoisted(() => ({
  clearArtistLink: vi.fn(async (_a: string, _s: string): Promise<any> => ({ oldValue: null })),
  logMcpAudit: vi.fn(async (_e: unknown) => {}),
  requireMcpAuth: vi.fn((): string => "test-hash"),
}));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink }));
vi.mock("@/lib/mcp/logMcpAudit", () => ({ logMcpAudit }));
vi.mock("@/lib/mcpAuth/requireMcpAuth", () => ({ requireMcpAuth }));
const { registerDeleteArtistLinkTool } = await import("@/lib/mcp/registerDeleteArtistLinkTool");

const artistId = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  requireMcpAuth.mockReturnValue("test-hash");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("delete_artist_link", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerDeleteArtistLinkTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["delete_artist_link"]);
    expect(tool.title).toBe("Delete Artist Link");
    expect(tool.description).toBe("Remove a platform link from an artist record");
  });

  it("clears the link, audits it with the old value, and reports it", async () => {
    clearArtistLink.mockResolvedValue({ oldValue: "old-handle" });
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName: "x",
    });
    expect(clearArtistLink).toHaveBeenCalledWith(artistId, "x");
    expect(parsed).toEqual({ success: true, siteName: "x", oldValue: "old-handle" });
    expect(result.isError).toBeUndefined();
    expect(logMcpAudit).toHaveBeenCalledWith({
      artistId,
      field: "x",
      action: "delete",
      oldValue: "old-handle",
      apiKeyHash: "test-hash",
    });
  });

  it("checks auth before clearing, and is AUTH_REQUIRED without it", async () => {
    requireMcpAuth.mockImplementation(() => {
      throw new McpAuthError("Authentication required");
    });
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName: "x",
    });
    expect(parsed).toEqual({ error: "Authentication required", code: "AUTH_REQUIRED" });
    expect(result.isError).toBe(true);
    expect(clearArtistLink).not.toHaveBeenCalled();
  });

  it("is NOT_SET when the link was empty, unaudited", async () => {
    clearArtistLink.mockResolvedValue({ oldValue: null });
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName: "x",
    });
    expect(parsed).toEqual({ error: "Link is not set", code: "NOT_SET" });
    expect(result.isError).toBe(true);
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("maps the writer's errors: NOT_FOUND, INVALID_PLATFORM, INTERNAL_ERROR", async () => {
    const tool = registerDeleteArtistLinkTool(testServer());
    clearArtistLink.mockRejectedValueOnce(new Error(`Artist not found: ${artistId}`));
    expect((await callTool(tool, { artistId, siteName: "x" })).parsed).toEqual({
      error: "Artist not found",
      code: "NOT_FOUND",
    });
    clearArtistLink.mockRejectedValueOnce(new Error("Column not in writable whitelist: bio"));
    expect((await callTool(tool, { artistId, siteName: "bio" })).parsed).toEqual({
      error: "Invalid platform name",
      code: "INVALID_PLATFORM",
    });
    clearArtistLink.mockRejectedValueOnce(new Error("db down"));
    const { result, parsed } = await callTool(tool, { artistId, siteName: "x" });
    expect(parsed).toEqual({ error: "Failed to delete artist link", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });

  it("still succeeds when the audit log fails", async () => {
    clearArtistLink.mockResolvedValue({ oldValue: "old" });
    logMcpAudit.mockRejectedValue(new Error("DB connection failed"));
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName: "x",
    });
    expect(parsed.success).toBe(true);
    expect(result.isError).toBeUndefined();
  });
});
