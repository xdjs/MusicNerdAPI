import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTool, testServer } from "@/lib/mcp/__tests__/toolTestUtils";

const { search } = vi.hoisted(() => ({ search: vi.fn(async (_n: string): Promise<any[]> => []) }));
vi.mock("@/lib/artists/searchForArtistByName", () => ({ searchForArtistByName: search }));
const { registerSearchArtistsTool } = await import("@/lib/mcp/registerSearchArtistsTool");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("search_artists", () => {
  it("registers with Web's name, title and description", () => {
    const server = testServer();
    const tool = registerSearchArtistsTool(server);
    expect(Object.keys((server as any)._registeredTools)).toEqual(["search_artists"]);
    expect(tool.title).toBe("Search Artists");
    expect(tool.description).toBe("Search for artists in the MusicNerd database by name");
  });

  it("returns summaries (id and name only) and the count", async () => {
    search.mockResolvedValue([
      { id: "a1", name: "Daft Punk", spotify: "s", bio: "b" },
      { id: "a2", name: null },
    ]);
    const { result, parsed } = await callTool(registerSearchArtistsTool(testServer()), {
      query: " daft ",
      limit: 10,
    });
    expect(search).toHaveBeenCalledWith("daft");
    expect(parsed).toEqual({
      artists: [
        { id: "a1", name: "Daft Punk" },
        { id: "a2", name: "" },
      ],
      totalResults: 2,
    });
    expect(result.isError).toBeUndefined();
  });

  it("returns no results for an empty query without searching", async () => {
    const { parsed } = await callTool(registerSearchArtistsTool(testServer()), { query: "   " });
    expect(parsed).toEqual({ artists: [], totalResults: 0 });
    expect(search).not.toHaveBeenCalled();
  });

  it("clamps the limit to 50 and defaults it to 10", async () => {
    search.mockResolvedValue(Array.from({ length: 60 }, (_, i) => ({ id: `a${i}`, name: "x" })));
    const tool = registerSearchArtistsTool(testServer());
    expect((await callTool(tool, { query: "x", limit: 500 })).parsed.totalResults).toBe(50);
    expect((await callTool(tool, { query: "x" })).parsed.totalResults).toBe(10);
    expect((await callTool(tool, { query: "x", limit: 3 })).parsed.totalResults).toBe(3);
  });

  it("is INTERNAL_ERROR when the search throws", async () => {
    search.mockRejectedValue(new Error("db"));
    const { result, parsed } = await callTool(registerSearchArtistsTool(testServer()), {
      query: "x",
    });
    expect(parsed).toEqual({ error: "Failed to search artists", code: "INTERNAL_ERROR" });
    expect(result.isError).toBe(true);
  });
});
