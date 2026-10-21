import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { McpAuthError } from "@/lib/mcpAuth/McpAuthError";

const { extractArtistId, setArtistLink, logMcpAudit, requireMcpAuth } = vi.hoisted(() => ({
  extractArtistId: vi.fn(async (_u: string): Promise<any> => null),
  setArtistLink: vi.fn(async (_a: string, _s: string, _v: string): Promise<any> => ({
    oldValue: null,
    artistName: "A",
  })),
  logMcpAudit: vi.fn(async (_e: unknown) => {}),
  requireMcpAuth: vi.fn((): string => "test-hash"),
}));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink }));
vi.mock("@/lib/mcp/logMcpAudit", () => ({ logMcpAudit }));
vi.mock("@/lib/mcpAuth/requireMcpAuth", () => ({ requireMcpAuth }));
const { registerSetArtistLinkTool } = await import("@/lib/mcp/registerSetArtistLinkTool");

const artistId = "00000000-0000-0000-0000-000000000001";
const ig = { siteName: "instagram", id: "testuser", cardPlatformName: "Instagram" };

beforeEach(() => {
  vi.clearAllMocks();
  requireMcpAuth.mockReturnValue("test-hash");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("set_artist_link", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerSetArtistLinkTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["set_artist_link"]);
    expect(tool.title).toBe("Set Artist Link");
    expect(tool.description).toBe(
      "Set a platform link on an artist record. The platform is automatically inferred from the URL.",
    );
  });

  it("sets the link the URL implies and reports the old value", async () => {
    extractArtistId.mockResolvedValue({ ...ig, id: "new-user" });
    setArtistLink.mockResolvedValue({ oldValue: "old-user", artistName: "A" });
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/new-user",
    });
    expect(setArtistLink).toHaveBeenCalledWith(artistId, "instagram", "new-user");
    expect(parsed).toEqual({
      success: true,
      siteName: "instagram",
      extractedId: "new-user",
      oldValue: "old-user",
    });
    expect(result.isError).toBeUndefined();
  });

  it("writes the audit entry with the exact fields, after the write", async () => {
    extractArtistId.mockResolvedValue({ ...ig, id: "new-user" });
    setArtistLink.mockResolvedValue({ oldValue: "old-user", artistName: "A" });
    await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/new-user",
    });
    expect(logMcpAudit).toHaveBeenCalledWith({
      artistId,
      field: "instagram",
      action: "set",
      submittedUrl: "https://instagram.com/new-user",
      oldValue: "old-user",
      newValue: "new-user",
      apiKeyHash: "test-hash",
    });
    expect(setArtistLink.mock.invocationCallOrder[0]).toBeLessThan(
      logMcpAudit.mock.invocationCallOrder[0],
    );
  });

  it("checks auth before extracting or writing, and is AUTH_REQUIRED without it", async () => {
    requireMcpAuth.mockImplementation(() => {
      throw new McpAuthError("Authentication required");
    });
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/test",
    });
    expect(parsed).toEqual({ error: "Authentication required", code: "AUTH_REQUIRED" });
    expect(result.isError).toBe(true);
    expect(extractArtistId).not.toHaveBeenCalled();
    expect(setArtistLink).not.toHaveBeenCalled();
  });

  it("is INVALID_URL when no platform reads the URL, or it reads an empty id", async () => {
    const tool = registerSetArtistLinkTool(testServer());
    extractArtistId.mockResolvedValueOnce(null);
    expect((await callTool(tool, { artistId, url: "https://unknown.com/test" })).parsed).toEqual({
      error: "URL does not match any approved platform",
      code: "INVALID_URL",
    });
    extractArtistId.mockResolvedValueOnce({ siteName: "instagram", id: "" });
    const { result, parsed } = await callTool(tool, { artistId, url: "https://instagram.com/" });
    expect(parsed.code).toBe("INVALID_URL");
    expect(result.isError).toBe(true);
    expect(setArtistLink).not.toHaveBeenCalled();
  });

  it("is NOT_FOUND for an unknown artist", async () => {
    extractArtistId.mockResolvedValue(ig);
    setArtistLink.mockRejectedValue(new Error(`Artist not found: ${artistId}`));
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/test",
    });
    expect(parsed).toEqual({ error: "Artist not found", code: "NOT_FOUND" });
    expect(result.isError).toBe(true);
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("is a terminal CONFLICT with the conflict's message, unaudited", async () => {
    extractArtistId.mockResolvedValue({
      siteName: "spotify",
      id: "spotify-123",
      cardPlatformName: "Spotify",
    });
    setArtistLink.mockRejectedValue(
      new ArtistLinkConflictError("That spotify artist ID is already linked to a different artist"),
    );
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://open.spotify.com/artist/spotify-123",
    });
    expect(parsed).toEqual({
      error: "That spotify artist ID is already linked to a different artist",
      code: "CONFLICT",
    });
    expect(result.isError).toBe(true);
    expect(logMcpAudit).not.toHaveBeenCalled();
  });

  it("still succeeds when the audit log fails", async () => {
    extractArtistId.mockResolvedValue(ig);
    setArtistLink.mockResolvedValue({ oldValue: null, artistName: "A" });
    logMcpAudit.mockRejectedValue(new Error("DB connection failed"));
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/testuser",
    });
    expect(parsed.success).toBe(true);
    expect(result.isError).toBeUndefined();
  });

  it("is INTERNAL_ERROR for any other failure", async () => {
    extractArtistId.mockResolvedValue(ig);
    setArtistLink.mockRejectedValue(new Error("db down"));
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/testuser",
    });
    expect(parsed).toEqual({ error: "Failed to set artist link", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
