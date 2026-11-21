import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";
import { OwnershipChangedError } from "@/lib/research/OwnershipChangedError";

const { clearArtistLink, findApprovedClaim, withArtistOperation } = vi.hoisted(() => ({
  clearArtistLink: vi.fn(async (_a: string, _s: string): Promise<any> => ({ oldValue: null })),
  findApprovedClaim: vi.fn(async (_d: unknown, _a: string): Promise<any> => undefined),
  withArtistOperation: vi.fn((_a: string, _o: unknown, op: () => unknown) => op()),
}));
vi.mock("@/lib/db/db", () => ({ db: {} }));
vi.mock("@/lib/artistLinks/clearArtistLink", () => ({ clearArtistLink }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim }));
vi.mock("@/lib/ownership/withArtistOperation", () => ({ withArtistOperation }));
const { registerDeleteArtistLinkTool: register } =
  await import("@/lib/mcp/registerDeleteArtistLinkTool");
const registerDeleteArtistLinkTool = (server: ReturnType<typeof testServer>) =>
  register(server, "admin-1");

const artistId = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
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

  it("clears the link as the connection's admin and reports the old value", async () => {
    clearArtistLink.mockResolvedValue({ oldValue: "old-handle" });
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName: "x",
    });
    expect(clearArtistLink).toHaveBeenCalledWith(artistId, "x");
    expect(withArtistOperation).toHaveBeenCalledWith(
      artistId,
      { userId: "admin-1", expectedClaimId: null },
      expect.any(Function),
    );
    expect(parsed).toEqual({ success: true, siteName: "x", oldValue: "old-handle" });
    expect(result.isError).toBeUndefined();
  });

  it("is NOT_SET when the link was empty", async () => {
    clearArtistLink.mockResolvedValue({ oldValue: null });
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName: "x",
    });
    expect(parsed).toEqual({ error: "Link is not set", code: "NOT_SET" });
    expect(result.isError).toBe(true);
  });

  it("maps the writer's errors: FORBIDDEN, NOT_FOUND, INVALID_PLATFORM, INTERNAL_ERROR", async () => {
    const tool = registerDeleteArtistLinkTool(testServer());
    clearArtistLink.mockRejectedValueOnce(new OwnershipChangedError());
    expect((await callTool(tool, { artistId, siteName: "x" })).parsed.code).toBe("FORBIDDEN");
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
});

it.each(["spotify", "deezer"])(
  "fails closed for %s, which needs the owner's disconnect",
  async siteName => {
    const { result, parsed } = await callTool(registerDeleteArtistLinkTool(testServer()), {
      artistId,
      siteName,
    });
    expect(result.isError).toBe(true);
    expect(parsed.code).toBe("OWNER_DISCONNECT_REQUIRED");
    expect(clearArtistLink).not.toHaveBeenCalled();
  },
);
