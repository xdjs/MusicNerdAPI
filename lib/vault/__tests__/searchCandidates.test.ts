import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchRun } from "@/lib/vault/__tests__/searchRun";

const { webSearch } = vi.hoisted(() => ({ webSearch: vi.fn() }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
const { searchCandidates } = await import("@/lib/vault/searchCandidates");

beforeEach(() => {
  webSearch.mockReset().mockResolvedValue([]);
});

describe("searchCandidates", () => {
  it("runs the five queries, five results each, and asks a durable run to throw on failure", async () => {
    await searchCandidates(searchRun({ requireComplete: true }), null);
    expect(webSearch).toHaveBeenCalledTimes(5);
    expect(webSearch).toHaveBeenCalledWith("Grimes", { maxResults: 5, throwOnError: true });
    await searchCandidates(searchRun(), null);
    expect(webSearch).toHaveBeenLastCalledWith('"Grimes" discogs credits', { maxResults: 5 });
  });

  it("dedupes across queries by normalized URL, drops untitled hits and types each by its URL", async () => {
    webSearch.mockResolvedValue([
      { url: "https://example.com/a", title: "A", snippet: "s" },
      { url: "https://www.example.com/a/", title: "A again", snippet: "s" },
      { url: "https://example.com/b", title: "", snippet: "s" },
    ]);
    const results = await searchCandidates(searchRun(), null);
    expect(results.map(r => r.url)).toEqual(["https://example.com/a"]);
    expect(results[0]).toHaveProperty("type");
  });

  it("seeds the MusicBrainz homepage first, so it survives the dedupe", async () => {
    webSearch.mockResolvedValue([
      { url: "https://grimes.com", title: "Search copy", snippet: "x" },
    ]);
    const results = await searchCandidates(searchRun(), "https://grimes.com");
    expect(results).toEqual([
      { url: "https://grimes.com", title: "Grimes", snippet: "", type: expect.any(String) },
    ]);
  });

  it("propagates a provider failure", async () => {
    webSearch.mockRejectedValue(new Error("provider unavailable"));
    await expect(searchCandidates(searchRun({ requireComplete: true }), null)).rejects.toThrow(
      "provider unavailable",
    );
  });
});
