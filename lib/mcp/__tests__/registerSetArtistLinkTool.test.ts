import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const { extractArtistId, setArtistLink, findApprovedClaim, withArtistOperation } = vi.hoisted(
  () => ({
    extractArtistId: vi.fn(async (_u: string): Promise<any> => null),
    setArtistLink: vi.fn(async (_a: string, _s: string, _v: string): Promise<any> => ({
      oldValue: null,
      artistName: "A",
    })),
    findApprovedClaim: vi.fn(async (_d: unknown, _a: string): Promise<any> => ({ id: "claim-1" })),
    withArtistOperation: vi.fn((_a: string, _o: unknown, op: () => unknown) => op()),
  }),
);
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/artists/extractArtistId", () => ({ extractArtistId }));
vi.mock("@/lib/artistLinks/setArtistLink", () => ({ setArtistLink }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation }));
const { registerSetArtistLinkTool: register } = await import("@/lib/mcp/registerSetArtistLinkTool");
const registerSetArtistLinkTool = (server: ReturnType<typeof testServer>) =>
  register(server, "admin-1");

const artistId = "00000000-0000-0000-0000-000000000001";
const ig = { siteName: "instagram", id: "testuser", cardPlatformName: "Instagram" };

beforeEach(() => {
  vi.clearAllMocks();
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

  it("writes as the connection's admin, under the artist's current claim", async () => {
    extractArtistId.mockResolvedValue(ig);
    await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/testuser",
    });
    expect(findApprovedClaim).toHaveBeenCalledWith({}, artistId);
    expect(withArtistOperation).toHaveBeenCalledWith(
      artistId,
      { userId: "admin-1", expectedClaimId: "claim-1" },
      expect.any(Function),
    );
  });

  it("is FORBIDDEN when the claim or the admin role changed under the write", async () => {
    extractArtistId.mockResolvedValue(ig);
    setArtistLink.mockRejectedValue(new OwnershipChangedError());
    const { result, parsed } = await callTool(registerSetArtistLinkTool(testServer()), {
      artistId,
      url: "https://instagram.com/testuser",
    });
    expect(parsed.code).toBe("FORBIDDEN");
    expect(result.isError).toBe(true);
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
  });

  it("is a terminal CONFLICT with the conflict's message", async () => {
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
