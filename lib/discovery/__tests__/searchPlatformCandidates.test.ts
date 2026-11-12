import { describe, it, expect, vi, beforeEach } from "vitest";

const { webSearch, resultPassesNameCheck } = vi.hoisted(() => ({
  webSearch: vi.fn(),
  resultPassesNameCheck: vi.fn(),
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch }));
vi.mock("@/lib/discovery/resultPassesNameCheck", () => ({ resultPassesNameCheck }));
const { searchPlatformCandidates } = await import("@/lib/discovery/searchPlatformCandidates");

beforeEach(() => {
  webSearch.mockReset();
  resultPassesNameCheck.mockReset();
});

describe("searchPlatformCandidates", () => {
  it("searches the platform's own domain and keeps passing https results in rank order", async () => {
    webSearch.mockResolvedValueOnce([
      { url: "http://instagram.com/a", title: "A", snippet: "" },
      { url: "https://instagram.com/b", title: "B", snippet: "" },
      { url: "https://instagram.com/c", title: "", snippet: "C snippet" },
    ]);
    resultPassesNameCheck.mockResolvedValue(true);
    expect(await searchPlatformCandidates("instagram", "q", "Pete Rango")).toEqual([
      {
        tier: 4,
        provisional: true,
        platform: "instagram",
        url: "https://instagram.com/b",
        reasoning: 'Web search hit on instagram.com: "B"',
        discoveryEvidence: {
          version: 1,
          method: "name_web_search",
          artistName: "Pete Rango",
          sourceUrl: "https://instagram.com/b",
          observedTitle: "B",
        },
      },
      {
        tier: 4,
        provisional: true,
        platform: "instagram",
        url: "https://instagram.com/c",
        reasoning: 'Web search hit on instagram.com: "C snippet"',
        discoveryEvidence: {
          version: 1,
          method: "name_web_search",
          artistName: "Pete Rango",
          sourceUrl: "https://instagram.com/c",
          observedTitle: null,
        },
      },
    ]);
    expect(webSearch).toHaveBeenCalledWith("q", {
      includeDomains: ["instagram.com"],
      maxResults: 5,
    });
  });

  it("is empty when the search throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    webSearch.mockRejectedValueOnce(new Error("down"));
    expect(await searchPlatformCandidates("x", "q", "P")).toEqual([]);
    error.mockRestore();
  });
});

it("requests strict provider errors for a required search", async () => {
  const failure = new Error("Web search failed (tavily: http_432)");
  webSearch.mockRejectedValueOnce(failure);
  await expect(searchPlatformCandidates("x", "q", "P", true)).rejects.toBe(failure);
  expect(webSearch).toHaveBeenCalledWith("q", expect.objectContaining({ throwOnError: true }));
});

it("marks a matching-name web result as provisional, not ownership evidence", async () => {
  webSearch.mockResolvedValueOnce([
    { url: "https://youtube.com/@namesake", title: "Nova", snippet: "" },
  ]);
  resultPassesNameCheck.mockResolvedValue(true);
  const candidates = await searchPlatformCandidates("youtube", "q", "Nova");
  expect(candidates[0].provisional).toBe(true);
});

it("records a bounded search title, never the snippet, without URL tracking parameters", async () => {
  webSearch.mockResolvedValueOnce([
    {
      url: "https://x.com/nova?tracking=1#bio",
      title: "t".repeat(3000),
      snippet: "private reasoning",
    },
  ]);
  resultPassesNameCheck.mockResolvedValue(true);
  const [candidate] = await searchPlatformCandidates("x", "q", "Nova");
  expect(candidate.discoveryEvidence).toEqual({
    version: 1,
    method: "name_web_search",
    artistName: "Nova",
    sourceUrl: "https://x.com/nova",
    observedTitle: "t".repeat(2000),
  });
});
