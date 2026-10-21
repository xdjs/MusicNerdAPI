import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";

const { getArtistById, toArtistDetail } = vi.hoisted(() => ({
  getArtistById: vi.fn(async (_id: string): Promise<any> => undefined),
  toArtistDetail: vi.fn(async (_a: unknown): Promise<any> => ({})),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById }));
vi.mock("@/lib/mcp/toArtistDetail", () => ({ toArtistDetail }));
const { registerGetArtistTool } = await import("@/lib/mcp/registerGetArtistTool");

const id = "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("get_artist", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerGetArtistTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["get_artist"]);
    expect(tool.title).toBe("Get Artist");
    expect(tool.description).toBe("Get detailed information about an artist by their MusicNerd ID");
  });

  it("returns { artist } from the detail transformer", async () => {
    const artist = { id, name: "A" };
    const detail = { id, name: "A", bio: null, spotifyId: null, deezerId: null, socialLinks: {} };
    getArtistById.mockResolvedValue(artist);
    toArtistDetail.mockResolvedValue(detail);
    const { result, parsed } = await callTool(registerGetArtistTool(testServer()), { id });
    expect(getArtistById).toHaveBeenCalledWith(id);
    expect(toArtistDetail).toHaveBeenCalledWith(artist);
    expect(parsed).toEqual({ artist: detail });
    expect(result.isError).toBeUndefined();
  });

  it("is NOT_FOUND for an unknown artist", async () => {
    getArtistById.mockResolvedValue(undefined);
    const { result, parsed } = await callTool(registerGetArtistTool(testServer()), { id });
    expect(parsed).toEqual({ error: "Artist not found", code: "NOT_FOUND" });
    expect(result.isError).toBe(true);
    expect(toArtistDetail).not.toHaveBeenCalled();
  });

  it("is INVALID_INPUT for a zod error and INTERNAL_ERROR otherwise", async () => {
    getArtistById.mockRejectedValueOnce(new z.ZodError([]));
    const tool = registerGetArtistTool(testServer());
    expect((await callTool(tool, { id })).parsed).toEqual({
      error: "Invalid artist ID format - must be a valid UUID",
      code: "INVALID_INPUT",
    });
    getArtistById.mockRejectedValueOnce(new Error("db"));
    const { result, parsed } = await callTool(tool, { id });
    expect(parsed).toEqual({ error: "Failed to get artist", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
